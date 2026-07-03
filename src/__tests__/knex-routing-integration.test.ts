import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import type { Knex } from 'knex'
import type { BackendRecord } from '@/backends/types.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { KnexTableDefinition, ResourceDefinition } from '@/resources/types.ts'
import { createToken } from '@/auth/jwt.ts'
import { hashPassword } from '@/auth/password.ts'
import type { AnyKnexDatabase } from '@/types.ts'

const routeMocks = vi.hoisted(() => {
  const memberAction = vi.fn(async () => {})
  const collectionAction = vi.fn(async () => {})

  const columns = [
    { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
    { name: 'title', sqlName: 'post_title', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
    { name: 'createdAt', sqlName: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
    { name: 'updatedAt', sqlName: 'updated_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
  ]

  const table = { tableName: 'posts', columns }
  const postsResource = {
    table,
    tableName: 'posts',
    routePath: 'posts',
    displayName: 'Post',
    primaryKey: 'id',
    columns,
    options: {
      index: { filters: ['title'] },
      memberActions: [{ name: 'Archive', handler: memberAction }],
      collectionActions: [{ name: 'Refresh', handler: collectionAction }],
    },
  }

  return { collectionAction, memberAction, postsResource }
})

vi.mock('@/resources/loader.ts', () => ({
  loadResources: async () => ({ resources: [routeMocks.postsResource], errors: [] }),
  validateResources: () => [],
}))

import { DrizzleAdmin } from '@/DrizzleAdmin.ts'

const SESSION_SECRET = 'knex-routing-secret-at-least-32-chars!'

describe('Knex routing integration', () => {
  let app: Awaited<ReturnType<DrizzleAdmin['build']>>['app']
  let db: FakeKnex
  let adminPasswordHash: string

  beforeAll(async () => {
    adminPasswordHash = await hashPassword('password')
  })

  beforeEach(async () => {
    routeMocks.memberAction.mockClear()
    routeMocks.collectionAction.mockClear()
    db = new FakeKnex()
    db.rows = [{ id: 1, post_title: 'Hello', created_at: new Date(), updated_at: new Date() }]
    db.firstRow = { id: 1, post_title: 'Hello', created_at: new Date(), updated_at: new Date() }
    db.insertRows = [{ id: 2, post_title: 'Created' }]

    const admin = new DrizzleAdmin({
      backend: 'knex',
      db: db.instance,
      dialect: 'postgresql',
      adminUsers: makeAdminUsersTable(),
      sessionSecret: SESSION_SECRET,
      resourcesDir: './resources',
    })
    app = (await admin.build()).app
  })

  it('renders authenticated Knex-backed index, show, and form pages', async () => {
    const cookie = await makeAuthCookie()

    const index = await app.request('/posts?filter_title=Hello', { headers: { Cookie: cookie } })
    expect(index.status).toBe(200)
    expect(await index.text()).toContain('value="Hello"')
    expect(db.calls).toContainEqual({ method: 'where', args: ['post_title', 'ilike', '%Hello%'] })

    const show = await app.request('/posts/1', { headers: { Cookie: cookie } })
    expect(show.status).toBe(200)
    expect(await show.text()).toContain('Hello')

    const form = await app.request('/posts/new', { headers: { Cookie: cookie } })
    expect(form.status).toBe(200)
    expect(await form.text()).toContain('name="title"')
  })

  it('creates, updates, deletes, and runs actions with the Knex instance', async () => {
    const authCookie = await makeAuthCookie()
    const { csrfCookie, csrfToken } = await getCsrf('/posts/new', authCookie)

    const create = await app.request('/posts', {
      method: 'POST',
      headers: formHeaders(`${authCookie}; ${csrfCookie}`),
      body: new URLSearchParams({ _csrf: csrfToken, title: 'Created' }),
      redirect: 'manual',
    })
    expect(create.status).toBe(302)
    expect(create.headers.get('Location')).toBe('/posts/2')
    expect(db.calls).toContainEqual({ method: 'insert', args: [{ post_title: 'Created' }] })

    const update = await app.request('/posts/1?_method=PUT', {
      method: 'POST',
      headers: formHeaders(`${authCookie}; ${csrfCookie}`),
      body: new URLSearchParams({ _csrf: csrfToken, title: 'Updated' }),
      redirect: 'manual',
    })
    expect(update.status).toBe(302)
    expect(update.headers.get('Location')).toBe('/posts/1')
    expect(db.calls).toContainEqual({ method: 'update', args: [expect.objectContaining({ post_title: 'Updated' })] })

    const memberAction = await app.request('/posts/1/actions/archive', {
      method: 'POST',
      headers: formHeaders(`${authCookie}; ${csrfCookie}`),
      body: new URLSearchParams({ _csrf: csrfToken }),
      redirect: 'manual',
    })
    expect(memberAction.status).toBe(302)
    expect(routeMocks.memberAction).toHaveBeenCalledWith('1', db.instance)

    const collectionAction = await app.request('/posts/actions/refresh', {
      method: 'POST',
      headers: formHeaders(`${authCookie}; ${csrfCookie}`),
      body: new URLSearchParams({ _csrf: csrfToken }),
      redirect: 'manual',
    })
    expect(collectionAction.status).toBe(302)
    expect(routeMocks.collectionAction).toHaveBeenCalledWith(expect.anything(), db.instance)

    const deleted = await app.request('/posts/1?_method=DELETE', {
      method: 'POST',
      headers: { Cookie: authCookie },
      redirect: 'manual',
    })
    expect(deleted.status).toBe(302)
    expect(deleted.headers.get('Location')).toBe('/posts')
    expect(db.calls).toContainEqual({ method: 'delete', args: [] })
  })

  it('authenticates Knex admin users with SQL-name metadata', async () => {
    db.firstRow = { id: 1, email: 'admin@test.com', password_hash: adminPasswordHash }
    const { csrfCookie, csrfToken } = await getCsrf('/login')

    const response = await app.request('/login', {
      method: 'POST',
      headers: formHeaders(csrfCookie),
      body: new URLSearchParams({ _csrf: csrfToken, email: 'admin@test.com', password: 'password' }),
      redirect: 'manual',
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/')
    expect(response.headers.get('set-cookie')).toContain('admin_session=')
    expect(db.calls).toContainEqual({ method: 'where', args: ['email', 'admin@test.com'] })
  })

  async function getCsrf(path: string, existingCookie = '') {
    const response = await app.request(path, { headers: existingCookie ? { Cookie: existingCookie } : undefined })
    const html = await response.text()
    const csrfToken = html.match(/name="_csrf" value="([^"]+)"/)?.[1]
    const csrfCookie = response.headers.get('set-cookie')?.split(';')[0]

    if (!csrfToken || !csrfCookie) {
      throw new Error('Expected CSRF token and cookie')
    }

    return { csrfCookie, csrfToken }
  }
})

async function makeAuthCookie(): Promise<string> {
  const token = await createToken({ adminId: 1, email: 'admin@test.com' }, SESSION_SECRET, 'session')
  return `admin_session=${token}`
}

function formHeaders(cookie: string): HeadersInit {
  return {
    Cookie: cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
}

function makeAdminUsersTable(): KnexTableDefinition {
  return {
    tableName: 'admin_users',
    columns: [
      makeColumn({ name: 'id', sqlName: 'id', dataType: 'integer', isPrimaryKey: true, hasDefault: true }),
      makeColumn({ name: 'email', sqlName: 'email', dataType: 'text' }),
      makeColumn({ name: 'passwordHash', sqlName: 'password_hash', dataType: 'text' }),
      makeColumn({ name: 'createdAt', sqlName: 'created_at', dataType: 'timestamp', hasDefault: true }),
      makeColumn({ name: 'updatedAt', sqlName: 'updated_at', dataType: 'timestamp', hasDefault: true }),
    ],
  }
}

function makeColumn(overrides: Partial<ColumnMeta> = {}): ColumnMeta {
  return {
    name: 'title',
    sqlName: 'title',
    dataType: 'text',
    isNullable: false,
    isPrimaryKey: false,
    hasDefault: false,
    ...overrides,
  }
}

interface FakeCall {
  method: string
  args: unknown[]
}

class FakeKnex {
  calls: FakeCall[] = []
  rows: BackendRecord[] = []
  firstRow: BackendRecord | undefined
  insertRows: BackendRecord[] = []

  instance = ((tableName: string) => new FakeQuery(tableName, this)) as unknown as AnyKnexDatabase
}

class FakeQuery {
  private result: unknown = []

  constructor(tableName: string, private readonly db: FakeKnex) {
    db.calls.push({ method: 'table', args: [tableName] })
  }

  count(args: unknown) {
    this.db.calls.push({ method: 'count', args: [args] })
    this.result = [{ count: this.db.rows.length }]
    return this
  }

  select(...args: unknown[]) {
    this.db.calls.push({ method: 'select', args })
    this.result = this.db.rows
    return this
  }

  where(...args: unknown[]) {
    this.db.calls.push({ method: 'where', args })
    return this
  }

  first() {
    this.db.calls.push({ method: 'first', args: [] })
    return Promise.resolve(this.db.firstRow)
  }

  insert(values: BackendRecord) {
    this.db.calls.push({ method: 'insert', args: [values] })
    this.result = this.db.insertRows
    return this
  }

  update(values: BackendRecord) {
    this.db.calls.push({ method: 'update', args: [values] })
    return Promise.resolve(1)
  }

  delete() {
    this.db.calls.push({ method: 'delete', args: [] })
    return Promise.resolve(1)
  }

  returning(...args: unknown[]) {
    this.db.calls.push({ method: 'returning', args })
    return Promise.resolve(this.result)
  }

  limit(value: number) {
    this.db.calls.push({ method: 'limit', args: [value] })
    return this
  }

  offset(value: number) {
    this.db.calls.push({ method: 'offset', args: [value] })
    return this
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

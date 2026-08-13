import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import { createToken } from '@/auth/jwt.ts'
import { hashPassword } from '@/auth/password.ts'

const routeMocks = vi.hoisted(() => {
  interface FakeCall {
    method: string
    args: unknown[]
  }

  interface FakeMetadata {
    tableName: string
    columns: string[]
    primaryKey: string
    columnMetadata: Array<{
      name: string
      dataType: string
      isNullable: boolean
      isPrimaryKey: boolean
      hasDefault: boolean
    }>
  }

  function makeInstance(row: Record<string, unknown>, calls: FakeCall[]) {
    return {
      ...row,
      attributes: () => ({ ...row }),
      assignAndSave: async (values: Record<string, unknown>) => {
        calls.push({ method: 'assignAndSave', args: [values] })
      },
    }
  }

  class FakeRepository {
    calls: FakeCall[] = []
    rows: Record<string, unknown>[] = []
    firstRow: Record<string, unknown> | undefined
    insertRows: Record<string, unknown>[] = []
    findRow: Record<string, unknown> | undefined

    constructor(readonly metadata: FakeMetadata) {}

    reset(): void {
      this.calls = []
      this.rows = []
      this.firstRow = undefined
      this.insertRows = []
      this.findRow = undefined
    }

    async create(values: Record<string, unknown>) {
      this.calls.push({ method: 'create', args: [values] })
      return makeInstance(this.insertRows[0] ?? { id: 2, ...values }, this.calls)
    }

    async find(id: string | number) {
      this.calls.push({ method: 'find', args: [id] })
      return this.findRow ? makeInstance(this.findRow, this.calls) : null
    }

    where(attrs: Record<string, unknown>) {
      this.calls.push({ method: 'chainWhere', args: [attrs] })
      const chain = {
        where: () => chain,
        limit: () => chain,
        offset: () => chain,
        count: async () => 0,
        all: async () => [],
        first: async () => null,
        update: async (values: Record<string, unknown>) => {
          this.calls.push({ method: 'chainUpdate', args: [values] })
          return 1
        },
        delete: async () => {
          this.calls.push({ method: 'delete', args: [] })
          return 1
        },
        query: () => new FakeAdvancedQuery(),
      }

      return chain
    }

    query() {
      return new FakeAdvancedQuery()
    }

    createBuilder() {
      return new FakeBuilder(this)
    }
  }

  class FakeBuilder {
    private result: Record<string, unknown>[] = []

    constructor(private readonly repository: FakeRepository) {}

    select(...args: unknown[]) {
      this.repository.calls.push({ method: 'select', args })
      this.result = this.repository.rows
      return this
    }

    where(...args: unknown[]) {
      this.repository.calls.push({ method: 'where', args })
      return this
    }

    count(...args: unknown[]) {
      this.repository.calls.push({ method: 'count', args })
      this.result = [{ count: this.repository.rows.length }]
      return this
    }

    first() {
      this.repository.calls.push({ method: 'first', args: [] })
      return Promise.resolve(this.repository.firstRow)
    }

    limit(value: number) {
      this.repository.calls.push({ method: 'limit', args: [value] })
      return this
    }

    offset(value: number) {
      this.repository.calls.push({ method: 'offset', args: [value] })
      return this
    }

    then<TResult1 = Record<string, unknown>[], TResult2 = never>(
      onfulfilled?: ((value: Record<string, unknown>[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(this.result).then(onfulfilled, onrejected)
    }
  }

  class FakeAdvancedQuery {
    where() { return this }
    whereRaw() { return this }
    limit() { return this }
    offset() { return this }
    async rows() { return [] }
    async row() { return null }
  }

  const memberAction = vi.fn(async (_id: unknown, _context: { readonly repository: unknown }) => {})
  const collectionAction = vi.fn(async (_c: unknown, _context: { readonly repository: unknown }) => {})
  const columns = [
    { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
    { name: 'title', sqlName: 'title', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
    { name: 'created_at', sqlName: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
    { name: 'updated_at', sqlName: 'updated_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
  ]
  const postMetadata = {
    tableName: 'posts',
    columns: columns.map((column) => column.name),
    primaryKey: 'id',
    columnMetadata: columns,
  }
  const adminMetadata = {
    tableName: 'admin_users',
    columns: ['id', 'email', 'password_hash', 'created_at', 'updated_at'],
    primaryKey: 'id',
    columnMetadata: [
      { name: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
      { name: 'email', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
      { name: 'password_hash', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
      { name: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
      { name: 'updated_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
    ],
  }
  const postRepo = new FakeRepository(postMetadata)
  const adminRepo = new FakeRepository(adminMetadata)
  const postFactory = () => postRepo
  const adminFactory = () => adminRepo
  const postsResource = {
    table: postFactory,
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

  return { adminFactory, adminRepo, collectionAction, memberAction, postRepo, postsResource }
})

vi.mock('@/resources/loader.ts', () => ({
  loadResources: async () => ({ resources: [routeMocks.postsResource], errors: [] }),
  validateResources: () => [],
  applyReferencedBy: (resources: unknown[]) => resources,
}))

import { DrizzleAdmin } from '@/DrizzleAdmin.ts'

const SESSION_SECRET = 'persistence-routing-secret-32-chars!'

describe('Persistence routing integration', () => {
  let app: Awaited<ReturnType<DrizzleAdmin['build']>>['app']
  let adminPasswordHash: string

  beforeAll(async () => {
    adminPasswordHash = await hashPassword('password')
  })

  beforeEach(async () => {
    routeMocks.memberAction.mockClear()
    routeMocks.collectionAction.mockClear()
    routeMocks.postRepo.reset()
    routeMocks.adminRepo.reset()
    routeMocks.postRepo.rows = [{ id: 1, title: 'Hello', created_at: new Date(), updated_at: new Date() }]
    routeMocks.postRepo.findRow = { id: 1, title: 'Hello', created_at: new Date(), updated_at: new Date() }
    routeMocks.postRepo.insertRows = [{ id: 2, title: 'Created' }]
    routeMocks.adminRepo.firstRow = { id: 1, email: 'admin@test.com', password_hash: adminPasswordHash }

    const admin = new DrizzleAdmin({
      backend: 'persistence',
      dialect: 'postgresql',
      adminUsers: routeMocks.adminFactory,
      sessionSecret: SESSION_SECRET,
      resourcesDir: './resources',
    })
    app = (await admin.build()).app
  })

  it('renders authenticated Persistence-backed index, show, and form pages', async () => {
    const cookie = await makeAuthCookie()

    const index = await app.request('/posts?filter_title=Hello', { headers: { Cookie: cookie } })
    expect(index.status).toBe(200)
    expect(await index.text()).toContain('value="Hello"')
    expect(routeMocks.postRepo.calls).toContainEqual({ method: 'where', args: ['title', 'ilike', '%Hello%'] })

    const show = await app.request('/posts/1', { headers: { Cookie: cookie } })
    expect(show.status).toBe(200)
    expect(await show.text()).toContain('Hello')

    const form = await app.request('/posts/new', { headers: { Cookie: cookie } })
    expect(form.status).toBe(200)
    expect(await form.text()).toContain('name="title"')
  })

  it('creates, updates, deletes, and runs actions with a Persistence action context', async () => {
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
    expect(routeMocks.postRepo.calls).toContainEqual({ method: 'create', args: [{ title: 'Created' }] })

    const update = await app.request('/posts/1?_method=PUT', {
      method: 'POST',
      headers: formHeaders(`${authCookie}; ${csrfCookie}`),
      body: new URLSearchParams({ _csrf: csrfToken, title: 'Updated' }),
      redirect: 'manual',
    })
    expect(update.status).toBe(302)
    expect(update.headers.get('Location')).toBe('/posts/1')
    expect(routeMocks.postRepo.calls).toContainEqual({
      method: 'assignAndSave',
      args: [expect.objectContaining({ title: 'Updated' })],
    })

    const memberAction = await app.request('/posts/1/actions/archive', {
      method: 'POST',
      headers: formHeaders(`${authCookie}; ${csrfCookie}`),
      body: new URLSearchParams({ _csrf: csrfToken }),
      redirect: 'manual',
    })
    expect(memberAction.status).toBe(302)
    expect(routeMocks.memberAction).toHaveBeenCalledWith('1', expect.objectContaining({ getRepository: expect.any(Function) }))
    expect(routeMocks.memberAction.mock.calls[0]?.[1].repository).toBe(routeMocks.postRepo)

    const collectionAction = await app.request('/posts/actions/refresh', {
      method: 'POST',
      headers: formHeaders(`${authCookie}; ${csrfCookie}`),
      body: new URLSearchParams({ _csrf: csrfToken }),
      redirect: 'manual',
    })
    expect(collectionAction.status).toBe(302)
    expect(routeMocks.collectionAction.mock.calls[0]?.[1].repository).toBe(routeMocks.postRepo)

    // Delete needs the double-submit token like every other mutation; the
    // method override must not route around the CSRF check.
    const deleteWithoutCsrf = await app.request('/posts/1?_method=DELETE', {
      method: 'POST',
      headers: { Cookie: authCookie },
      redirect: 'manual',
    })
    expect(deleteWithoutCsrf.status).toBe(302)
    expect(deleteWithoutCsrf.headers.get('Location')).toBe('/posts/1')
    expect(routeMocks.postRepo.calls).not.toContainEqual({ method: 'delete', args: [] })

    const deleted = await app.request('/posts/1?_method=DELETE', {
      method: 'POST',
      headers: formHeaders(`${authCookie}; ${csrfCookie}`),
      body: new URLSearchParams({ _csrf: csrfToken }),
      redirect: 'manual',
    })
    expect(deleted.status).toBe(302)
    expect(deleted.headers.get('Location')).toBe('/posts')
    expect(routeMocks.postRepo.calls).toContainEqual({ method: 'delete', args: [] })
  })

  it('authenticates Persistence admin users with normalized passwordHash', async () => {
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
    expect(routeMocks.adminRepo.calls).toContainEqual({ method: 'where', args: ['email', 'admin@test.com'] })
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

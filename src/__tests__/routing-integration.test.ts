import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import type { Table } from 'drizzle-orm'
import type { AnyPgDatabase } from '@/types.ts'
import type { DrizzleAdminConfig } from '@/config.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import { createToken } from '@/auth/jwt.ts'

// --- Mocks ---

const mockPostsTable = {
  _columns: {
    id: { name: 'id', dataType: 'number', columnType: 'PgSerial', notNull: true, hasDefault: true, isPrimaryKey: true },
    title: { name: 'title', dataType: 'string', columnType: 'PgText', notNull: true, hasDefault: false, isPrimaryKey: false },
    createdAt: { name: 'createdAt', dataType: 'date', columnType: 'PgTimestamp', notNull: true, hasDefault: true, isPrimaryKey: false },
    updatedAt: { name: 'updatedAt', dataType: 'date', columnType: 'PgTimestamp', notNull: true, hasDefault: true, isPrimaryKey: false },
  },
  id: { name: 'id' },
  title: { name: 'title' },
  createdAt: { name: 'createdAt' },
  updatedAt: { name: 'updatedAt' },
}

const postsResource: ResourceDefinition = {
  table: mockPostsTable as unknown as Table,
  tableName: 'posts',
  routePath: 'posts',
  displayName: 'Post',
  options: {},
}

vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: Record<string, unknown>) =>
    (table as Record<string, unknown>)._columns ?? {},
  eq: () => {},
  sql: (strings: TemplateStringsArray) => strings.join(''),
}))

vi.mock('@/resources/loader.ts', () => ({
  loadResources: async () => ({
    resources: [postsResource],
    errors: [],
  }),
  validateResources: () => [],
}))

vi.mock('@/dialects/postgresql.ts', () => ({
  postgresqlAdapter: {
    name: 'postgresql',
    extractColumns: () => [
      { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
      { name: 'title', sqlName: 'title', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
      { name: 'createdAt', sqlName: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
      { name: 'updatedAt', sqlName: 'updated_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
    ],
  },
}))

import { DrizzleAdmin } from '@/DrizzleAdmin.ts'

// --- Helpers ---

const SESSION_SECRET = 'test-secret-for-integration'

function makeAdminUsers() {
  return {
    _columns: {
      id: {},
      email: {},
      passwordHash: {},
      createdAt: {},
      updatedAt: {},
    },
    id: {},
    email: {},
    passwordHash: {},
    createdAt: {},
    updatedAt: {},
  }
}

function makeMockDb() {
  const chainable = () => {
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.from = () => chain
    chain.where = () => chain
    chain.limit = () => chain
    chain.offset = () => chain
    chain.insert = () => chain
    chain.values = () => chain
    chain.returning = () => Promise.resolve([{ id: 1, title: 'Test Post' }])
    chain.update = () => chain
    chain.set = () => chain
    chain.delete = () => chain
    // Default: returns array with one record for selects
    chain.then = (resolve: (v: unknown) => void) =>
      resolve([{ id: 1, title: 'Test Post', createdAt: new Date(), updatedAt: new Date() }])
    return chain
  }

  return {
    select: (arg?: unknown) => {
      const chain = chainable()
      // If select is called with { count: ... }, return count result
      if (arg && typeof arg === 'object' && 'count' in arg) {
        chain.from = () => ({
          then: (resolve: (v: unknown) => void) => resolve([{ count: 1 }]),
        })
      }
      return chain
    },
    insert: () => chainable(),
    update: () => chainable(),
    delete: () => chainable(),
  } as unknown as AnyPgDatabase
}

function makeConfig(overrides: Partial<DrizzleAdminConfig> = {}): DrizzleAdminConfig {
  return {
    db: makeMockDb(),
    dialect: 'postgresql',
    adminUsers: makeAdminUsers() as unknown as Table,
    sessionSecret: SESSION_SECRET,
    resourcesDir: './resources',
    ...overrides,
  }
}

async function makeAuthCookie(): Promise<string> {
  const token = await createToken({ adminId: 1, email: 'admin@test.com' }, SESSION_SECRET)
  return `admin_session=${token}`
}

// --- Tests ---

describe('Routing integration with basePath', () => {
  let parentApp: Hono

  beforeAll(async () => {
    const admin = new DrizzleAdmin(makeConfig({ basePath: '/admin' }))
    const handler = await admin.build()
    parentApp = new Hono()
    parentApp.route('/admin', handler.app)
  })

  describe('Auth routes (unauthenticated)', () => {
    it('GET /admin/login returns 200 with login form', async () => {
      const res = await parentApp.request('/admin/login')
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('action="/admin/login"')
    })

    it('GET /admin/ without auth redirects to /admin/login', async () => {
      const res = await parentApp.request('/admin/', { redirect: 'manual' })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/admin/login')
    })

    it('GET /admin/posts without auth redirects to /admin/login', async () => {
      const res = await parentApp.request('/admin/posts', { redirect: 'manual' })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/admin/login')
    })
  })

  describe('Auth routes (authenticated)', () => {
    it('GET /admin/ redirects to /admin/posts (first resource)', async () => {
      const cookie = await makeAuthCookie()
      // Hono route('/admin', subApp) matches /admin but not /admin/ for root
      // The real browser navigation will use /admin (no trailing slash)
      const res = await parentApp.request('/admin', {
        headers: { Cookie: cookie },
        redirect: 'manual',
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/admin/posts')
    })

    it('GET /admin/logout redirects to /admin/login and clears cookie', async () => {
      const cookie = await makeAuthCookie()
      const res = await parentApp.request('/admin/logout', {
        headers: { Cookie: cookie },
        redirect: 'manual',
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/admin/login')
      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      expect(setCookieHeader).toContain('admin_session=')
      expect(setCookieHeader).toContain('Max-Age=0')
    })
  })

  describe('CRUD routes (authenticated)', () => {
    it('GET /admin/posts returns 200 with resource page', async () => {
      const cookie = await makeAuthCookie()
      const res = await parentApp.request('/admin/posts', {
        headers: { Cookie: cookie },
      })
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('/admin/posts')
    })

    it('GET /admin/posts/new returns 200 with create form', async () => {
      const cookie = await makeAuthCookie()
      const res = await parentApp.request('/admin/posts/new', {
        headers: { Cookie: cookie },
      })
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('/admin/posts')
    })

    it('GET /admin/posts/1 returns 200 with show page', async () => {
      const cookie = await makeAuthCookie()
      const res = await parentApp.request('/admin/posts/1', {
        headers: { Cookie: cookie },
      })
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('/admin/posts')
    })

    it('GET /admin/posts/1/edit returns 200 with edit form', async () => {
      const cookie = await makeAuthCookie()
      const res = await parentApp.request('/admin/posts/1/edit', {
        headers: { Cookie: cookie },
      })
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('/admin/posts')
    })
  })

  describe('CSRF cookie path in sub-app', () => {
    it('CSRF cookie has path=/ on login page', async () => {
      const res = await parentApp.request('/admin/login')
      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      expect(setCookieHeader).toMatch(/Path=\/(?:;|$)/)
    })
  })
})

describe('Routing integration without basePath (regression)', () => {
  let app: Hono

  beforeAll(async () => {
    const admin = new DrizzleAdmin(makeConfig({ basePath: '' }))
    const handler = await admin.build()
    app = handler.app
  })

  it('GET /login returns 200', async () => {
    const res = await app.request('/login')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('action="/login"')
  })

  it('GET / without auth redirects to /login', async () => {
    const res = await app.request('/', { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login')
  })

  it('GET / with auth redirects to /posts', async () => {
    const cookie = await makeAuthCookie()
    const res = await app.request('/', {
      headers: { Cookie: cookie },
      redirect: 'manual',
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/posts')
  })

  it('GET /posts with auth returns 200', async () => {
    const cookie = await makeAuthCookie()
    const res = await app.request('/posts', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
  })
})

describe('Standalone mode with basePath', () => {
  it('wraps routes under basePath when simulating start()', async () => {
    const admin = new DrizzleAdmin(makeConfig({ basePath: '/admin' }))
    const handler = await admin.build()

    // Simulate what start() does: wrap in a parent at basePath
    const wrapper = new Hono()
    wrapper.route('/admin', handler.app)

    const res = await wrapper.request('/admin/login')
    expect(res.status).toBe(200)
  })

  it('root path without basePath prefix returns 404', async () => {
    const admin = new DrizzleAdmin(makeConfig({ basePath: '/admin' }))
    const handler = await admin.build()

    const wrapper = new Hono()
    wrapper.route('/admin', handler.app)

    const res = await wrapper.request('/login')
    expect(res.status).toBe(404)
  })

  it('root redirect works end-to-end under basePath', async () => {
    const admin = new DrizzleAdmin(makeConfig({ basePath: '/admin' }))
    const handler = await admin.build()

    const wrapper = new Hono()
    wrapper.route('/admin', handler.app)

    const cookie = await makeAuthCookie()
    const res = await wrapper.request('/admin', {
      headers: { Cookie: cookie },
      redirect: 'manual',
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/admin/posts')
  })
})

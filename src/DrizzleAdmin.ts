import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { DrizzleAdminConfig, MinimalAdminUsersTable } from './config.js'
import { validateAdminUsersTable } from './auth/contract.js'
import { postgresqlAdapter } from './dialects/postgresql.js'
import { loadResources, validateResources } from './resources/loader.js'
import type { ResourceDefinition } from './resources/types.js'
import { createAuthRoutes } from './routes/auth.js'
import { createCrudRoutes } from './routes/crud.js'
import { authMiddleware } from './auth/middleware.js'
import { loginPage } from './views/login.js'
import { hashPassword } from './auth/password.js'

export class DrizzleAdmin<T extends MinimalAdminUsersTable> {
  private config: DrizzleAdminConfig<T>
  private app: Hono
  private resources: ResourceDefinition[] = []

  constructor(config: DrizzleAdminConfig<T>) {
    this.config = config
    this.app = new Hono()

    validateAdminUsersTable(config.adminUsers)

    if (config.dialect !== 'postgresql') {
      throw new Error(`Dialect "${config.dialect}" is not yet supported`)
    }
  }

  async initialize(): Promise<void> {
    const { resources, errors } = await loadResources(this.config.resourcesDir)

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`[DrizzleAdmin] ${error}`)
      }
      throw new Error(
        `Failed to load resources. ${errors.length} error(s) found.`
      )
    }

    const validationErrors = validateResources(resources)
    if (validationErrors.length > 0) {
      for (const error of validationErrors) {
        console.error(`[DrizzleAdmin] ${error}`)
      }
      throw new Error(
        `Invalid resource configuration. ${validationErrors.length} error(s) found.`
      )
    }

    this.resources = resources
    console.log(`[DrizzleAdmin] Loaded ${resources.length} resource(s)`)
  }

  getResources(): ResourceDefinition[] {
    return this.resources
  }

  private setupRoutes(): void {
    const adapter = postgresqlAdapter

    const authRoutes = createAuthRoutes({
      db: this.config.db,
      adminUsers: this.config.adminUsers,
      sessionSecret: this.config.sessionSecret,
      renderLogin: (props) => loginPage(props),
    })
    this.app.route('/', authRoutes)

    this.app.use('/*', authMiddleware(this.config.sessionSecret))

    this.app.get('/', (c) => {
      if (this.resources.length === 0) {
        return c.text('No resources configured')
      }
      return c.redirect(`/${this.resources[0].routePath}`)
    })

    for (const resource of this.resources) {
      const crudRoutes = createCrudRoutes({
        db: this.config.db,
        resource,
        adapter,
        sessionSecret: this.config.sessionSecret,
        allResources: this.resources,
      })
      this.app.route(`/${resource.routePath}`, crudRoutes)
    }
  }

  async seed(params: { email: string; password: string } & Record<string, unknown>): Promise<void> {
    const { email, password, ...extra } = params
    const db = this.config.db as any
    const adminUsers = this.config.adminUsers as any

    const [existing] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1)

    if (existing) {
      console.log(`Admin user "${email}" already exists, skipping seed.`)
      return
    }

    const passwordHash = await hashPassword(password)

    await db.insert(adminUsers).values({
      email,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extra,
    })

    console.log(`Created admin user: ${email}`)
  }

  getApp(): Hono {
    return this.app
  }

  async start(): Promise<void> {
    await this.initialize()
    this.setupRoutes()

    const port = this.config.port ?? 3001
    console.log(`DrizzleAdmin running on http://localhost:${port}`)

    if (typeof (globalThis as any).Deno !== 'undefined') {
      ;(globalThis as any).Deno.serve({ port }, this.app.fetch)
    } else {
      const { serve } = await import('@hono/node-server')
      serve({
        fetch: this.app.fetch,
        port,
      })
    }
  }
}

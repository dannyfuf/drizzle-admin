import { Hono } from "hono";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Knex } from "knex";
import type { AdminBackend } from "@/backends/types.ts";
import { createDrizzleBackend } from "@/backends/drizzle.ts";
import { createKnexBackend } from "@/backends/knex.ts";
import { createPersistenceBackend } from "@/backends/persistence.ts";
import type { DrizzleAdminConfig, KnexBackendConfig, PersistenceBackendConfig } from "@/config.ts";
import { validateDeclaredFilters } from "@/resources/filters.ts";
import { applyReferencedBy, loadResources, validateResources } from "@/resources/loader.ts";
import { validateReferencedBy, validateReferences } from "@/resources/references.ts";
import type { KnexTableDefinition, ResourceDefinition } from "@/resources/types.ts";
import { createAuthRoutes } from "@/routes/auth.ts";
import { createCrudRoutes } from "@/routes/crud.ts";
import { authMiddleware } from "@/auth/middleware.ts";
import { createInMemoryLoginRateLimiter } from "@/auth/rate-limit.ts";
import { loginPage } from "@/views/login.ts";
import { hashPassword } from "@/auth/password.ts";
import { adminUrl, normalizeBasePath } from "@/utils/url.ts";
import type { AnyPgDatabase, PersistenceActionContext, PersistenceResourceRef } from "@/types.ts";

/**
 * The main admin panel class that sets up routes, authentication, and CRUD
 * interfaces for your Drizzle ORM tables.
 *
 * Supports both Node.js (via `@hono/node-server`) and Deno runtimes.
 *
 * @example
 * ```ts
 * const admin = new DrizzleAdmin(defineConfig({
 *   db,
 *   dialect: "postgresql",
 *   adminUsers,
 *   // Must be at least 32 characters — generate 32+ random bytes and keep it out of source control.
 *   sessionSecret: process.env.ADMIN_SESSION_SECRET!,
 *   resourcesDir: "./resources",
 * }));
 * await admin.start();
 * ```
 */
export interface DrizzleAdminHandler {
  /** The internal Hono app — use with mainApp.route('/path', handler.app) */
  app: Hono;
  /** Standard Web fetch handler — (request: Request) => Response | Promise<Response> */
  fetch: (request: Request) => Response | Promise<Response>;
}

export class DrizzleAdmin {
  private config: DrizzleAdminConfig;
  private app: Hono;
  private resources: AdminResourceDefinition[] = [];
  private basePath: string;
  private backend: ActiveBackend;

  /** Creates a new DrizzleAdmin instance with the given configuration. */
  constructor(config: DrizzleAdminConfig) {
    if (typeof config.sessionSecret !== "string" || config.sessionSecret.length < 32) {
      throw new Error(
        "sessionSecret must be a string of at least 32 characters. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }

    this.config = config;
    this.app = new Hono();
    this.backend = createBackend(config);

    this.basePath = normalizeBasePath(config.basePath ?? '');

    this.backend.validateAdminUsersTable(config.adminUsers);
  }

  /** Loads resource definitions from the configured `resourcesDir` and validates them. */
  async initialize(): Promise<void> {
    const { resources, errors } = await loadResources(this.config.resourcesDir, this.backend);

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`[DrizzleAdmin] ${error}`);
      }
      throw new Error(
        `Failed to load resources. ${errors.length} error(s) found.`,
      );
    }

    const validationErrors = validateResources(resources);
    const filterValidationErrors = resources.flatMap((resource) =>
      validateDeclaredFilters(resource, resource.columns),
    );
    const referenceValidationErrors = resources.flatMap((resource) =>
      validateReferences(resource, resources),
    );
    const referencedByValidationErrors = resources.flatMap((resource) =>
      validateReferencedBy(resource, resources),
    );
    const allValidationErrors = [
      ...validationErrors,
      ...filterValidationErrors,
      ...referenceValidationErrors,
      ...referencedByValidationErrors,
    ];
    if (allValidationErrors.length > 0) {
      for (const error of allValidationErrors) {
        console.error(`[DrizzleAdmin] ${error}`);
      }
      throw new Error(
        `Invalid resource configuration. ${allValidationErrors.length} error(s) found.`,
      );
    }

    const resolvedResources = applyReferencedBy(resources);
    this.resources = resolvedResources;
    console.log(`[DrizzleAdmin] Loaded ${resolvedResources.length} resource(s)`);
  }

  /** Returns the loaded resource definitions. */
  getResources(): AdminResourceDefinition[] {
    return this.resources;
  }

  private setupRoutes(): void {
    const authRoutes = createAuthRoutes({
      backend: this.backend,
      adminUsers: this.config.adminUsers,
      sessionSecret: this.config.sessionSecret,
      basePath: this.basePath,
      renderLogin: (props) => loginPage(props),
      rateLimiter: this.config.loginRateLimiter ?? createInMemoryLoginRateLimiter(this.config.loginRateLimit),
      trustProxyHeader: this.config.loginRateLimit?.trustProxyHeader ?? false,
    });
    this.app.route("/", authRoutes);

    this.app.use("/*", authMiddleware(this.config.sessionSecret, this.basePath));

    this.app.get("/", (c) => {
      if (this.resources.length === 0) {
        return c.text("No resources configured");
      }
      return c.redirect(adminUrl(this.basePath, `/${this.resources[0].routePath}`));
    });

    for (const resource of this.resources) {
      const crudRoutes = createCrudRoutes({
        backend: this.backend,
        resource,
        sessionSecret: this.config.sessionSecret,
        allResources: this.resources,
        basePath: this.basePath,
      });
      this.app.route(`/${resource.routePath}`, crudRoutes);
    }
  }

  /**
   * Seeds an admin user if one with the given email does not already exist.
   *
   * @param params - Must include `email` and `password`. Additional fields are passed through to the insert.
   */
  async seed(
    params: { email: string; password: string } & Record<string, unknown>,
  ): Promise<void> {
    const { email, password, ...extra } = params;
    const adminTable = this.config.adminUsers;

    const existing = await this.backend.findAdminByEmail(adminTable, email);

    if (existing) {
      console.log(`Admin user "${email}" already exists, skipping seed.`);
      return;
    }

    const passwordHash = await hashPassword(password);

    await this.backend.insertAdminUser(adminTable, {
      email,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extra,
    } as Record<string, unknown>);

    console.log(`Created admin user: ${email}`);
  }

  /** Returns the underlying Hono app instance for custom route mounting. */
  getApp(): Hono {
    return this.app;
  }

  /**
   * Builds the admin panel without starting a server.
   * Returns a handler object that can be mounted into an existing application
   * via the Hono or Express adapters, or used directly with its `fetch` method.
   */
  async build(): Promise<DrizzleAdminHandler> {
    await this.initialize();
    this.setupRoutes();

    return {
      app: this.app,
      fetch: this.app.fetch,
    };
  }

  /** Initializes resources, sets up routes, and starts the HTTP server. */
  async start(): Promise<void> {
    const handler = await this.build();

    const port = this.config.port ?? 3001;

    // In standalone mode, mount the app under basePath so routes match
    // the URLs generated by adminUrl(). Without this, routes are at /login
    // but links point to /admin/login.
    let fetchHandler: (request: Request) => Response | Promise<Response>;
    if (this.basePath) {
      const wrapper = new Hono();
      wrapper.route(this.basePath, handler.app);
      fetchHandler = wrapper.fetch;
    } else {
      fetchHandler = handler.fetch;
    }

    console.log(`DrizzleAdmin running on http://localhost:${port}${this.basePath}`);

    const g = globalThis as Record<string, unknown>;
    if (typeof g.Deno !== "undefined") {
      const deno = g.Deno as { serve: (opts: { port: number }, handler: unknown) => void };
      deno.serve({ port }, fetchHandler);
    } else {
      const { serve } = await import("@hono/node-server");
      serve({
        fetch: fetchHandler,
        port,
      });
    }
  }
}

type ActiveTable = PgTable | KnexTableDefinition | PersistenceResourceRef
type ActiveDatabase = AnyPgDatabase | Knex | PersistenceActionContext
type ActiveBackend = AdminBackend<ActiveDatabase, ActiveTable>
type AdminResourceDefinition = ResourceDefinition<ActiveTable, ActiveDatabase>

function createBackend(config: DrizzleAdminConfig): ActiveBackend {
  if (isKnexConfig(config)) {
    if (config.dialect !== "postgresql") {
      throw new Error(`Knex backend only supports dialect "postgresql". Got: "${config.dialect}".`)
    }

    return createKnexBackend(config.db) as ActiveBackend
  }

  if (isPersistenceConfig(config)) {
    const dialect = (config as { dialect: string }).dialect
    if (dialect !== "postgresql") {
      throw new Error(`Persistence backend only supports dialect "postgresql". Got: "${dialect}".`)
    }

    return createPersistenceBackend() as ActiveBackend
  }

  if (config.dialect !== "postgresql") {
    throw new Error(`Dialect "${config.dialect}" is not yet supported`)
  }

  return createDrizzleBackend(config.db) as ActiveBackend
}

function isKnexConfig(config: DrizzleAdminConfig): config is KnexBackendConfig {
  return config.backend === 'knex'
}

function isPersistenceConfig(config: DrizzleAdminConfig): config is PersistenceBackendConfig {
  return config.backend === 'persistence'
}

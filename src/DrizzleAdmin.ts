import { Hono } from "hono";
import { eq, getTableColumns } from "drizzle-orm";
import type { DrizzleAdminConfig } from "@/config.ts";
import { validateAdminUsersTable } from "@/auth/contract.ts";
import { postgresqlAdapter } from "@/dialects/postgresql.ts";
import { loadResources, validateResources } from "@/resources/loader.ts";
import type { ResourceDefinition } from "@/resources/types.ts";
import { createAuthRoutes } from "@/routes/auth.ts";
import { createCrudRoutes } from "@/routes/crud.ts";
import { authMiddleware } from "@/auth/middleware.ts";
import { loginPage } from "@/views/login.ts";
import { hashPassword } from "@/auth/password.ts";
import { adminUrl } from "@/utils/url.ts";

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
 *   sessionSecret: "secret",
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
  private resources: ResourceDefinition[] = [];
  private basePath: string;

  /** Creates a new DrizzleAdmin instance with the given configuration. */
  constructor(config: DrizzleAdminConfig) {
    this.config = config;
    this.app = new Hono();

    // Normalize and validate basePath
    const raw = config.basePath ?? '';
    if (raw) {
      if (!raw.startsWith('/')) {
        throw new Error(`basePath must start with "/". Got: "${raw}"`);
      }
      if (raw.includes('//')) {
        throw new Error(`basePath must not contain "//". Got: "${raw}"`);
      }
    }
    this.basePath = raw.endsWith('/') ? raw.slice(0, -1) : raw;

    validateAdminUsersTable(config.adminUsers);

    if (config.dialect !== "postgresql") {
      throw new Error(`Dialect "${config.dialect}" is not yet supported`);
    }
  }

  /** Loads resource definitions from the configured `resourcesDir` and validates them. */
  async initialize(): Promise<void> {
    const { resources, errors } = await loadResources(this.config.resourcesDir);

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`[DrizzleAdmin] ${error}`);
      }
      throw new Error(
        `Failed to load resources. ${errors.length} error(s) found.`,
      );
    }

    const validationErrors = validateResources(resources);
    if (validationErrors.length > 0) {
      for (const error of validationErrors) {
        console.error(`[DrizzleAdmin] ${error}`);
      }
      throw new Error(
        `Invalid resource configuration. ${validationErrors.length} error(s) found.`,
      );
    }

    this.resources = resources;
    console.log(`[DrizzleAdmin] Loaded ${resources.length} resource(s)`);
  }

  /** Returns the loaded resource definitions. */
  getResources(): ResourceDefinition[] {
    return this.resources;
  }

  private setupRoutes(): void {
    const adapter = postgresqlAdapter;

    const authRoutes = createAuthRoutes({
      db: this.config.db,
      adminUsers: this.config.adminUsers,
      sessionSecret: this.config.sessionSecret,
      basePath: this.basePath,
      renderLogin: (props) => loginPage(props),
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
        db: this.config.db,
        resource,
        adapter,
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
    const db = this.config.db;
    const adminTable = this.config.adminUsers;
    const cols = getTableColumns(this.config.adminUsers);

    const [existing] = await db
      .select()
      .from(adminTable)
      .where(eq(cols.email!, email))
      .limit(1);

    if (existing) {
      console.log(`Admin user "${email}" already exists, skipping seed.`);
      return;
    }

    const passwordHash = await hashPassword(password);

    await db.insert(adminTable).values({
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

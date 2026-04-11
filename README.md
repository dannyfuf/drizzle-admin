# DrizzleAdmin

A server-rendered admin panel for [Drizzle ORM](https://orm.drizzle.team/) applications inspired by RoR [Active Admin](https://activeadmin.info/). Provides automatic CRUD interfaces for your database tables with minimal configuration.

- Zero frontend build step - server-rendered HTML with Tailwind CSS via CDN
- Dark mode UI inspired by shadcn
- JWT authentication with bcrypt password hashing
- File-based resource registration
- Custom member and collection actions
- Mount into existing Hono or Express apps, or run standalone
- Sidebar folder grouping for organizing resources
- Works with Node.js and Deno
- PostgreSQL support (more dialects planned)

## Installation

### npm / pnpm

```bash
pnpm add drizzle-admin
# or
npm install drizzle-admin
```

### Deno / JSR

```ts
import { DrizzleAdmin } from '@dafu/drizzle-admin'
```

Or add to your import map:

```json
{
  "imports": {
    "drizzle-admin": "jsr:@dafu/drizzle-admin"
  }
}
```

### Peer Dependencies

DrizzleAdmin expects you already have `drizzle-orm` and a database driver (e.g., `pg`) in your project.

## Quick Start

### 1. Define your admin users table

DrizzleAdmin requires an admin users table with specific columns. Add this to your Drizzle schema:

```ts
// db/schema/admin-users.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

The table **must** have these columns (TypeScript property names): `id`, `email`, `passwordHash`, `createdAt`, `updatedAt`.

### 2. Create resource files

Create a directory for your admin resources. Each file exports a resource definition using `defineResource()`:

```
admin/
  resources/
    posts.ts
    users.ts
    categories.ts
```

```ts
// admin/resources/posts.ts
import { defineResource } from 'drizzle-admin'
import { posts } from '../../db/schema/posts'

export default defineResource(posts)
```

### 3. Configure and start

```ts
// admin/index.ts
import { DrizzleAdmin, defineConfig } from 'drizzle-admin'
import { db } from '../db'
import { adminUsers } from '../db/schema/admin-users'

const admin = new DrizzleAdmin(
  defineConfig({
    db,
    dialect: 'postgresql',
    adminUsers,
    sessionSecret: process.env.ADMIN_SESSION_SECRET!,
    resourcesDir: './admin/resources',
    port: 3001,
  })
)

// Seed the first admin user
await admin.seed({
  email: 'admin@example.com',
  password: 'changeme',
})

// Start the admin server
await admin.start()
```

Run it:

```bash
npx tsx admin/index.ts
```

Then open `http://localhost:3001` and sign in.

## Configuration

### `defineConfig(options)`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `db` | Drizzle DB instance | Yes | - | Your Drizzle database connection |
| `dialect` | `'postgresql'` | Yes | - | Database dialect (only PostgreSQL supported currently) |
| `adminUsers` | Drizzle table | Yes | - | Table for admin user authentication |
| `sessionSecret` | `string` | Yes | - | Secret key for signing JWT tokens (use a strong random string) |
| `resourcesDir` | `string` | Yes | - | Path to directory containing resource definition files |
| `port` | `number` | No | `3001` | Port to run the admin server on |
| `basePath` | `string` | No | `''` | Base URL path where the admin panel is mounted (e.g. `'/admin'`) |

### `basePath`

Use `basePath` when you want the admin panel to live under a sub-path. All routes, redirects, sidebar links, and form actions are automatically prefixed:

```ts
defineConfig({
  // ...
  basePath: '/admin',
})
```

With `basePath: '/admin'`, the login page is served at `/admin/login`, resources at `/admin/posts`, etc. Trailing slashes are stripped automatically.

## Integrating with Existing Apps

Instead of running a standalone server with `start()`, you can use `build()` to get a handler and mount it into your existing application.

### `build()`

Returns a `DrizzleAdminHandler` with two properties:

- `app` - the internal Hono app instance
- `fetch` - a standard Web `fetch` handler: `(request: Request) => Response | Promise<Response>`

```ts
const admin = new DrizzleAdmin(
  defineConfig({
    db,
    dialect: 'postgresql',
    adminUsers,
    sessionSecret: process.env.ADMIN_SESSION_SECRET!,
    resourcesDir: './admin/resources',
    basePath: '/admin',
  })
)

const handler = await admin.build()
```

### Hono Adapter

Mount DrizzleAdmin into an existing Hono application:

```ts
import { Hono } from 'hono'
import { DrizzleAdmin, defineConfig } from 'drizzle-admin'
import { honoAdapter } from 'drizzle-admin/hono'

const app = new Hono()
const admin = new DrizzleAdmin(defineConfig({ /* ... */ basePath: '/admin' }))
const handler = await admin.build()

app.route('/admin', honoAdapter(handler))

export default app
```

### Express Adapter

Mount DrizzleAdmin into an existing Express application:

```ts
import express from 'express'
import { DrizzleAdmin, defineConfig } from 'drizzle-admin'
import { expressAdapter } from 'drizzle-admin/express'

const app = express()
const admin = new DrizzleAdmin(defineConfig({ /* ... */ basePath: '/admin' }))
const handler = await admin.build()

app.use('/admin', expressAdapter(handler))

app.listen(3000)
```

### Direct `fetch` Handler

For any framework that supports the Web `fetch` API (Deno, Bun, Cloudflare Workers, etc.):

```ts
const handler = await admin.build()

Deno.serve({ port: 3000 }, handler.fetch)
```

## Resources

### Basic Resource

The simplest resource just wraps a Drizzle table:

```ts
import { defineResource } from 'drizzle-admin'
import { posts } from '../../db/schema/posts'

export default defineResource(posts)
```

DrizzleAdmin will automatically:
- Derive the URL path from the table name (`posts` -> `/posts`)
- Derive the display name (`posts` -> `Post`)
- Extract all columns and render appropriate form inputs
- Hide password columns from views
- Skip auto-managed columns (primary keys, `createdAt`, `updatedAt`) in create forms
- Show auto-managed columns as disabled (read-only) fields on edit forms

### Resource with Options

Pass a second argument to `defineResource()` to customize behavior:

```ts
import { defineResource } from 'drizzle-admin'
import { posts } from '../../db/schema/posts'

export default defineResource(posts, {
  folder: 'Content',
  permitParams: ['title', 'body', 'status'],
  index: {
    perPage: 50,
    exclude: ['body'],        // hide 'body' column from the listing
  },
  show: {
    exclude: ['internalNotes'],
  },
  form: {
    columns: ['title', 'body', 'status'],  // only show these fields in forms
  },
})
```

### Resource Options Reference

#### `folder` - Sidebar grouping

```ts
export default defineResource(posts, {
  folder: 'Content',
})
```

Groups resources under collapsible folders in the sidebar. Resources without a `folder` appear at the top level. Folders auto-expand when the active resource is inside them. Resources are sorted alphabetically within each group.

#### `permitParams` - Editable field whitelist

```ts
export default defineResource(posts, {
  permitParams: ['title', 'body', 'status'],
})
```

| Option | Type | Description |
|--------|------|-------------|
| `permitParams` | `string[]` | Only these columns are editable in forms and accepted in form submissions |

When set, only the listed columns appear as editable fields. Auto-managed columns (`id`, `createdAt`, `updatedAt`) still appear as disabled fields on edit forms. This also acts as a server-side allowlist -- columns not in the list are ignored during form processing.

#### `index` - Index/listing page

| Option | Type | Description |
|--------|------|-------------|
| `perPage` | `number` | Records per page (default: 20) |
| `columns` | `string[]` | Whitelist - only show these columns |
| `exclude` | `string[]` | Blacklist - hide these columns |

#### `show` - Detail page

| Option | Type | Description |
|--------|------|-------------|
| `columns` | `string[]` | Whitelist - only show these columns |
| `exclude` | `string[]` | Blacklist - hide these columns |

#### `form` - Create/edit forms

| Option | Type | Description |
|--------|------|-------------|
| `columns` | `string[]` | Whitelist - only show these fields |
| `exclude` | `string[]` | Blacklist - hide these fields |

#### `memberActions` - Actions on a single record

```ts
export default defineResource(posts, {
  memberActions: [
    {
      name: 'Archive',
      destructive: true,  // shows confirmation modal (default: true)
      handler: async (id, db) => {
        await db
          .update(posts)
          .set({ status: 'archived' })
          .where(eq(posts.id, Number(id)))
      },
    },
    {
      name: 'Publish',
      destructive: false,  // submits directly without confirmation
      handler: async (id, db) => {
        await db
          .update(posts)
          .set({ status: 'published', publishedAt: new Date() })
          .where(eq(posts.id, Number(id)))
      },
    },
  ],
})
```

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Button label for the action |
| `handler` | `(id, db) => Promise<void>` | Function that receives the record ID and db instance |
| `destructive` | `boolean` | If `true` (default), shows a confirmation modal before executing |

Member actions appear on the show page for each record.

#### `collectionActions` - Actions on the resource collection

```ts
export default defineResource(posts, {
  collectionActions: [
    {
      name: 'Publish All Drafts',
      handler: async (c, db) => {
        await db
          .update(posts)
          .set({ status: 'published' })
          .where(eq(posts.status, 'draft'))
      },
    },
  ],
})
```

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Button label for the action |
| `handler` | `(c, db) => Promise<void \| Response>` | Function that receives Hono context and db. Can return a `Response` for downloads. |

Collection actions appear on the index page alongside the "Create New" button.

### CSV Export (Built-in Action)

DrizzleAdmin ships with a CSV export collection action:

```ts
import { defineResource } from 'drizzle-admin'
import { createCsvExportAction } from 'drizzle-admin/actions/csv'
import { posts } from '../../db/schema/posts'

export default defineResource(posts, {
  collectionActions: [
    createCsvExportAction(posts),
  ],
})
```

This adds an "Export CSV" button to the index page that downloads all records as a CSV file.

## Supported Column Types

DrizzleAdmin automatically maps Drizzle column types to appropriate form inputs:

| Drizzle Type | Admin Input | Notes |
|-------------|-------------|-------|
| `text`, `varchar` | Text input | |
| `integer`, `serial` | Number input | |
| `boolean` | Checkbox | |
| `timestamp`, `date` | Datetime picker | |
| `json`, `jsonb` | Textarea | Displays formatted JSON |
| `pgEnum` | Select dropdown | Options derived from enum values |
| Password columns | Password input | Detected by column name containing "password" |

### Auto-managed Columns

These columns are automatically detected as "auto-managed":
- Primary key columns
- `createdAt` / `created_at` (when they have a default value)
- `updatedAt` / `updated_at` (when they have a default value)

On **create forms**, auto-managed columns are hidden entirely.

On **edit forms**, auto-managed columns are shown as disabled (read-only) fields with a muted visual style. This lets users see the values without accidentally modifying them.

Password columns are automatically hidden from index and show views.

## Authentication

DrizzleAdmin uses JWT-based authentication stored in HTTP-only cookies:

- Passwords are hashed with bcrypt (12 salt rounds)
- Sessions expire after 24 hours
- CSRF protection on all form submissions
- Cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` in production

### Seeding Admin Users

Use the `seed()` method to create admin users. It's safe to call on every startup - it skips if the email already exists:

```ts
await admin.seed({ email: 'admin@example.com', password: 'changeme' })
```

You can pass additional fields if your admin users table has extra columns:

```ts
await admin.seed({
  email: 'admin@example.com',
  password: 'changeme',
  name: 'Admin User',
  role: 'super_admin',
})
```

### Password Hashing Utility

The `hashPassword` function is exported for use outside of DrizzleAdmin (e.g., in custom scripts or seeders):

```ts
import { hashPassword } from 'drizzle-admin'

const hash = await hashPassword('my-password')
```

## Routes

For each resource, DrizzleAdmin generates these routes (prefixed with `basePath` if configured):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:resource` | Index - paginated table listing |
| GET | `/:resource/new` | Create form |
| POST | `/:resource` | Create record |
| GET | `/:resource/:id` | Show record details |
| GET | `/:resource/:id/edit` | Edit form |
| POST | `/:resource/:id?_method=PUT` | Update record |
| POST | `/:resource/:id?_method=DELETE` | Delete record |
| POST | `/:resource/:id/actions/:name` | Execute member action |
| POST | `/:resource/actions/:name` | Execute collection action |

Authentication routes:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/login` | Login page |
| POST | `/login` | Authenticate |
| GET/POST | `/logout` | Sign out |

The root path (`/`) redirects to the first resource's index page.

## Table Name Conventions

DrizzleAdmin derives URL paths and display names from your SQL table names:

| SQL Table Name | URL Path | Display Name |
|---------------|----------|-------------|
| `posts` | `/posts` | Post |
| `sale_orders` | `/sale-orders` | Sale Order |
| `user_profiles` | `/user-profiles` | User Profile |

## Full Example

Here's a complete example with a blog schema using Hono integration:

```ts
// db/schema.ts
import { pgTable, serial, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'

export const statusEnum = pgEnum('post_status', ['draft', 'published', 'archived'])

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: statusEnum('status').default('draft').notNull(),
  featured: boolean('featured').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

```ts
// admin/resources/posts.ts
import { defineResource } from 'drizzle-admin'
import { createCsvExportAction } from 'drizzle-admin/actions/csv'
import { eq } from 'drizzle-orm'
import { posts } from '../../db/schema'

export default defineResource(posts, {
  folder: 'Content',
  permitParams: ['title', 'body', 'status', 'featured'],
  index: {
    perPage: 25,
    exclude: ['body'],
  },
  memberActions: [
    {
      name: 'Publish',
      destructive: false,
      handler: async (id, db) => {
        await db.update(posts).set({ status: 'published' }).where(eq(posts.id, Number(id)))
      },
    },
    {
      name: 'Archive',
      handler: async (id, db) => {
        await db.update(posts).set({ status: 'archived' }).where(eq(posts.id, Number(id)))
      },
    },
  ],
  collectionActions: [
    createCsvExportAction(posts),
  ],
})
```

```ts
// admin/resources/categories.ts
import { defineResource } from 'drizzle-admin'
import { categories } from '../../db/schema'

export default defineResource(categories, {
  folder: 'Content',
})
```

### Standalone Server

```ts
// admin/index.ts
import { DrizzleAdmin, defineConfig } from 'drizzle-admin'
import { drizzle } from 'drizzle-orm/node-postgres'
import { adminUsers } from '../db/schema'

const db = drizzle(process.env.DATABASE_URL!)

const admin = new DrizzleAdmin(
  defineConfig({
    db,
    dialect: 'postgresql',
    adminUsers,
    sessionSecret: process.env.ADMIN_SESSION_SECRET!,
    resourcesDir: './admin/resources',
  })
)

await admin.seed({ email: 'admin@example.com', password: 'changeme' })
await admin.start()
```

### Mounted in Hono

```ts
// server.ts
import { Hono } from 'hono'
import { DrizzleAdmin, defineConfig } from 'drizzle-admin'
import { honoAdapter } from 'drizzle-admin/hono'
import { drizzle } from 'drizzle-orm/node-postgres'
import { adminUsers } from './db/schema'

const db = drizzle(process.env.DATABASE_URL!)

const admin = new DrizzleAdmin(
  defineConfig({
    db,
    dialect: 'postgresql',
    adminUsers,
    sessionSecret: process.env.ADMIN_SESSION_SECRET!,
    resourcesDir: './admin/resources',
    basePath: '/admin',
  })
)

await admin.seed({ email: 'admin@example.com', password: 'changeme' })
const handler = await admin.build()

const app = new Hono()
app.get('/', (c) => c.text('Hello!'))
app.route('/admin', honoAdapter(handler))

export default app
```

### Mounted in Express

```ts
// server.ts
import express from 'express'
import { DrizzleAdmin, defineConfig } from 'drizzle-admin'
import { expressAdapter } from 'drizzle-admin/express'
import { drizzle } from 'drizzle-orm/node-postgres'
import { adminUsers } from './db/schema'

const db = drizzle(process.env.DATABASE_URL!)

const admin = new DrizzleAdmin(
  defineConfig({
    db,
    dialect: 'postgresql',
    adminUsers,
    sessionSecret: process.env.ADMIN_SESSION_SECRET!,
    resourcesDir: './admin/resources',
    basePath: '/admin',
  })
)

await admin.seed({ email: 'admin@example.com', password: 'changeme' })
const handler = await admin.build()

const app = express()
app.get('/', (req, res) => res.send('Hello!'))
app.use('/admin', expressAdapter(handler))

app.listen(3000)
```

## API Reference

### `DrizzleAdmin`

#### `constructor(config: DrizzleAdminConfig)`

Creates a new admin instance. Validates the admin users table schema and dialect at construction time.

#### `async build(): Promise<DrizzleAdminHandler>`

Builds the admin panel without starting a server. Returns a `DrizzleAdminHandler` that can be mounted into an existing application via the Hono or Express adapters, or used directly with its `fetch` method.

```ts
interface DrizzleAdminHandler {
  /** The internal Hono app */
  app: Hono
  /** Standard Web fetch handler */
  fetch: (request: Request) => Response | Promise<Response>
}
```

#### `async start(): Promise<void>`

Loads resources, sets up all routes, and starts the HTTP server. Auto-detects Node.js vs Deno at runtime.

#### `async seed(params: { email: string; password: string } & Record<string, unknown>): Promise<void>`

Creates an admin user if one with that email doesn't already exist. Safe to call on every startup. Accepts additional fields beyond `email` and `password` that are passed through to the insert.

#### `async initialize(): Promise<void>`

Loads and validates resources without starting the server. Called automatically by `build()` and `start()`.

#### `getResources(): ResourceDefinition[]`

Returns the loaded resource definitions. Only available after `initialize()`, `build()`, or `start()` has been called.

### `defineConfig(config)`

Type-safe helper for creating configuration objects. Provides TypeScript inference for your admin users table type.

### `defineResource(table, options?)`

Creates a resource definition for DrizzleAdmin to load. Must be the default export of a file in your `resourcesDir`.

### `createCsvExportAction(table)`

Factory function that creates a collection action for exporting all records as CSV. Import from `drizzle-admin/actions/csv`.

### `hashPassword(password: string): Promise<string>`

Hashes a plaintext password using bcrypt with 12 salt rounds. Useful for creating admin users in custom scripts or seeders.

### `honoAdapter(handler: DrizzleAdminHandler): Hono`

Returns the Hono sub-app from a handler. Import from `drizzle-admin/hono`.

### `expressAdapter(handler: DrizzleAdminHandler): NodeMiddleware`

Converts a handler into Express/Connect-compatible middleware. Import from `drizzle-admin/express`.

## Development

```bash
pnpm install
pnpm test          # run tests
pnpm typecheck     # type check without emitting
pnpm build         # compile TypeScript
```

## License

MIT

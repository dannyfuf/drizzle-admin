# DrizzleAdmin

A server-rendered admin panel for [Drizzle ORM](https://orm.drizzle.team/), PostgreSQL-backed [Knex](https://knexjs.org/), and [Persistence ORM](https://github.com/dannyfuf/persistence) applications inspired by RoR [Active Admin](https://activeadmin.info/). Provides automatic CRUD interfaces for your database tables with minimal configuration.

- Zero frontend build step - server-rendered HTML with Tailwind CSS via CDN
- Dark mode UI inspired by shadcn
- JWT authentication with bcrypt password hashing
- File-based resource registration
- Custom member and collection actions
- Mount into existing Hono or Express apps, or run standalone
- Sidebar folder grouping for organizing resources
- Works with Node.js and Deno
- PostgreSQL support for Drizzle, Knex, and Persistence ORM (more dialects planned)

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

DrizzleAdmin includes `drizzle-orm` for the default Drizzle path and expects you to provide a database driver such as `pg`.

Knex support is optional. If you use Knex, install it in your application too:

```bash
pnpm add knex pg
```

Persistence support is optional. If `@dannyfuf/persistence` is not available from your registry, install it from the private GitHub repo over SSH:

```bash
pnpm add git+ssh://git@github.com/dannyfuf/persistence.git
```

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

## Knex Quick Start

Knex support is PostgreSQL-only. Because Knex does not expose table metadata like Drizzle, Knex resources use explicit column metadata.

### 1. Define Knex table metadata

```ts
// admin/tables.ts
import { defineKnexAdminUsers, defineKnexTable } from 'drizzle-admin'

export const adminUsers = defineKnexAdminUsers('admin_users', [
  { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
  { name: 'email', sqlName: 'email', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
  { name: 'passwordHash', sqlName: 'password_hash', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
  { name: 'createdAt', sqlName: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
  { name: 'updatedAt', sqlName: 'updated_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
])

export const postsTable = defineKnexTable('posts', [
  { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
  { name: 'title', sqlName: 'title', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
  { name: 'body', sqlName: 'body', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
  { name: 'createdAt', sqlName: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
  { name: 'updatedAt', sqlName: 'updated_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
])
```

The admin users metadata must include these logical column names: `id`, `email`, `passwordHash`, `createdAt`, and `updatedAt`. `sqlName` maps each logical name to the actual database column.

### 2. Create Knex resource files

```ts
// admin/resources/posts.ts
import { defineKnexResource } from 'drizzle-admin'
import { createCsvExportAction } from 'drizzle-admin/actions/csv'
import { postsTable } from '../tables'

export default defineKnexResource(postsTable, {
  permitParams: ['title', 'body'],
  index: {
    filters: ['title'],
  },
  collectionActions: [
    createCsvExportAction(postsTable),
  ],
})
```

### 3. Configure Knex mode

```ts
// admin/index.ts
import knex from 'knex'
import { DrizzleAdmin, defineConfig } from 'drizzle-admin'
import { adminUsers } from './tables'

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
})

const admin = new DrizzleAdmin(
  defineConfig({
    backend: 'knex',
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

## Persistence ORM Quick Start

Persistence support is PostgreSQL-only. DrizzleAdmin reads table names, primary keys, column types, nullability, defaults, and enum values from Persistence generated schema metadata, so Persistence resources do not accept hand-written column arrays.

### 1. Configure Persistence first

```ts
// persistence.ts
import knex from 'knex'
import { Model } from '@dannyfuf/persistence'
import { persistenceSchema } from './generated/persistenceSchema'

export const connection = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
})

Model.configure({ connection, schema: persistenceSchema })
```

### 2. Define admin user and resource models

```ts
// models.ts
import { Model, defineModel } from '@dannyfuf/persistence'

class AdminUserRecord extends Model<'admin_users'> {
  static tableName = 'admin_users' as const
}

class UserRecord extends Model<'users'> {
  static tableName = 'users' as const
}

export const AdminUser = defineModel(AdminUserRecord)
export const User = defineModel(UserRecord)
```

Persistence admin-user tables use database column names directly and must include `id`, `email`, `password_hash`, `created_at`, and `updated_at`. DrizzleAdmin normalizes `password_hash` to `passwordHash` internally for authentication.

### 3. Create Persistence resource files

```ts
// admin/resources/users.ts
import { definePersistenceResource } from 'drizzle-admin'
import { createCsvExportAction } from 'drizzle-admin/actions/csv'
import { User } from '../../models'

export default definePersistenceResource(User, {
  permitParams: ['email', 'name'],
  index: {
    filters: ['email'],
  },
  collectionActions: [
    createCsvExportAction(User),
  ],
})
```

### 4. Configure Persistence mode

```ts
// admin/index.ts
import '../persistence'
import { DrizzleAdmin, defineConfig, definePersistenceAdminUsers } from 'drizzle-admin'
import { AdminUser } from '../models'

const admin = new DrizzleAdmin(
  defineConfig({
    backend: 'persistence',
    dialect: 'postgresql',
    adminUsers: definePersistenceAdminUsers(AdminUser),
    sessionSecret: process.env.ADMIN_SESSION_SECRET!,
    resourcesDir: './admin/resources',
  })
)

await admin.seed({ email: 'admin@example.com', password: 'changeme' })
await admin.start()
```

Call `Model.configure({ connection, schema })` before `DrizzleAdmin.build()` or `DrizzleAdmin.start()`. Regenerate your Persistence schema after migrations so `persistenceSchema` includes `columnMetadata`; DrizzleAdmin uses that generated metadata as the source of truth for forms, filters, formatting, CSV export, and CRUD.

## Configuration

### `defineConfig(options)`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `db` | Drizzle DB or Knex instance | Drizzle/Knex only | - | Your configured database connection. Persistence uses `Model.configure()` instead. |
| `dialect` | `'postgresql'` | Yes | - | Database dialect (only PostgreSQL supported currently) |
| `adminUsers` | Drizzle table, Knex metadata, or Persistence repository factory | Yes | - | Table/model for admin user authentication |
| `backend` | `'drizzle' \| 'knex' \| 'persistence'` | No | `'drizzle'` | Use `'knex'` for Knex mode or `'persistence'` for Persistence ORM mode |
| `sessionSecret` | `string` | Yes | - | Secret key for signing JWT tokens. Must be at least 32 characters (the constructor throws otherwise) — see [Security model](#security-model) |
| `resourcesDir` | `string` | Yes | - | Path to directory containing resource definition files |
| `port` | `number` | No | `3001` | Port to run the admin server on |
| `basePath` | `string` | No | `''` | Base URL path where the admin panel is mounted (e.g. `'/admin'`) |
| `loginRateLimit` | `LoginRateLimitOptions` | No | see [Security model](#security-model) | Tuning for the built-in login rate limiter (thresholds, windows, `trustProxyHeader`) |
| `loginRateLimiter` | `LoginRateLimiter` | No | in-memory limiter | Custom limiter implementation (e.g. Redis-backed) replacing the built-in in-memory one — see [Security model](#security-model) |

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

### Knex Resource

Knex resources use `defineKnexResource()` with metadata from `defineKnexTable()`:

```ts
import { defineKnexResource } from 'drizzle-admin'
import { postsTable } from '../tables'

export default defineKnexResource(postsTable, {
  index: { filters: ['title'] },
})
```

The same resource options are available for Drizzle and Knex resources. Knex column `dataType` values should use the admin metadata types: `text`, `integer`, `boolean`, `enum`, `timestamp`, or `json`.

### Persistence Resource

Persistence resources use `definePersistenceResource()` with a repository factory returned by Persistence `defineModel()`:

```ts
import { definePersistenceResource } from 'drizzle-admin'
import { User } from '../models'

export default definePersistenceResource(User, {
  index: { filters: ['email'] },
})
```

Do not pass column metadata. Column names and admin metadata come from the generated Persistence schema and use database column names directly, including `snake_case` columns such as `created_at`.

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
    filters: ['title', 'status'],
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
| `filters` | `string[]` | Optional, order-sensitive list of filterable columns |

Filters are opt-in. When `index.filters` is omitted or set to `[]`, the index page renders no filter UI.

```ts
export default defineResource(posts, {
  index: {
    columns: ['id', 'title', 'status', 'featured'],
    filters: ['title', 'status', 'featured'],
  },
})
```

Declared filters are rendered in the order provided and round-trip through the index URL as namespaced query params such as `filter_title`. Supported filter types are:

- text: case-insensitive contains matching
- integer: exact matching
- boolean: exact matching
- enum: exact matching
- timestamp: exact matching

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
| `handler` | `(id, db) => Promise<void>` | Function that receives the record ID and configured db instance |
| `destructive` | `boolean` | If `true` (default), shows a confirmation modal before executing |

Member actions appear on the show page for each record. Drizzle resource actions receive the Drizzle database instance. Knex resource actions receive the Knex instance.

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
| `handler` | `(c, db) => Promise<void \| Response>` | Function that receives Hono context and the configured db. Can return a `Response` for downloads. |

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

For Knex resources, pass the same `KnexTableDefinition` used by `defineKnexResource()`:

```ts
createCsvExportAction(postsTable)
```

For Persistence resources, pass the same repository factory used by `definePersistenceResource()`:

```ts
createCsvExportAction(User)
```

## Supported Column Types

DrizzleAdmin automatically maps Drizzle column types to appropriate form inputs. Knex users provide the same admin metadata type explicitly, and Persistence users get it from generated `columnMetadata`:

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
    filters: ['title', 'status', 'featured'],
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

### `defineKnexTable(tableName, columns)`

Creates explicit table metadata for Knex resources and admin users. Every column must include `name`, `sqlName`, `dataType`, `isNullable`, `isPrimaryKey`, and `hasDefault`.

### `defineKnexAdminUsers(tableName, columns)`

Creates Knex admin-user table metadata. The logical column names must include `id`, `email`, `passwordHash`, `createdAt`, and `updatedAt`.

### `defineKnexResource(table, options?)`

Creates a Knex resource definition for DrizzleAdmin to load. Must be the default export of a file in your `resourcesDir`.

### `definePersistenceAdminUsers(repositoryFactory)`

Marks a Persistence repository factory as the admin-user model. The underlying table must have `id`, `email`, `password_hash`, `created_at`, and `updated_at` columns.

### `definePersistenceResource(repositoryFactory, options?)`

Creates a Persistence resource definition for DrizzleAdmin to load. Must be the default export of a file in your `resourcesDir`. Column metadata is inferred from Persistence generated schema metadata.

### `createCsvExportAction(table)`

Factory function that creates a collection action for exporting all records as CSV. Import from `drizzle-admin/actions/csv`.

### `hashPassword(password: string): Promise<string>`

Hashes a plaintext password using bcrypt with 12 salt rounds. Useful for creating admin users in custom scripts or seeders.

### `honoAdapter(handler: DrizzleAdminHandler): Hono`

Returns the Hono sub-app from a handler. Import from `drizzle-admin/hono`.

### `expressAdapter(handler: DrizzleAdminHandler): NodeMiddleware`

Converts a handler into Express/Connect-compatible middleware. Import from `drizzle-admin/express`.

## Security model

DrizzleAdmin exposes real database data behind a single email/password login. This section states exactly what that login guarantees — and what it deliberately does not.

### Session secret

- `sessionSecret` must be **at least 32 characters**; the constructor throws otherwise. Every session and CSRF token is an HS256 JWT signed with this one key, so its strength is the ceiling of the whole auth system.
- Generate it from random bytes and keep it out of source control:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- Rotating the secret immediately invalidates all outstanding sessions and CSRF tokens.

### Sessions

- Sessions are **stateless JWTs** valid for 24 hours, held in an `HttpOnly`, `SameSite=Strict` cookie scoped to `basePath`.
- There is **no server-side revocation**: logout clears the browser cookie, but a captured token remains valid until it expires. If a token is compromised, rotate `sessionSecret`.
- Cookies are marked `Secure` only when `NODE_ENV=production`. Always run the admin behind HTTPS in production.

### Login throttling

- Failed logins are rate limited with two independent fixed windows: **5 failures per client identifier per minute** and **10 failures per email per 15 minutes** (HTTP 429 once tripped). Successful login clears the email counter. Thresholds and windows are configurable via `loginRateLimit`.
- The client identifier is the socket address; `x-forwarded-for` is honored only if you opt in with `loginRateLimit.trustProxyHeader` (do this only behind a proxy you control). When no identifier is available, the per-email limit still applies.
- The built-in limiter is **in-memory and per-process**: counters reset on restart and are not shared between processes, so in multi-process deployments each process enforces the limits independently.
- Login failures are timing-uniform: unknown emails, broken stored hashes, and wrong passwords all cost one bcrypt compare and return the same generic response, so account existence cannot be probed.

### CSRF

- All mutating routes except logout (login, create/update/delete, custom actions) use signed double-submit tokens: the token must appear in both a cookie and the form body, carry a valid signature, and be typed `csrf` (a session token can never pass as a CSRF token, nor vice versa). Each issued token includes a random `jti`, so no two tokens are interchangeable.
- Logout is POST-only but deliberately **not** CSRF-checked: logout is idempotent, a forced logout is only a nuisance, and requiring a fresh token silently left sessions alive on shared machines whenever the token embedded in an older tab no longer matched the rotated cookie. A cross-site GET still cannot terminate a session.

### Passwords

- Stored as bcrypt hashes with 12 rounds (`hashPassword` / `seed()`).

### Deliberate non-goals

Weigh these before exposing the panel beyond a trusted network:

- **No MFA/TOTP.**
- **No audit logging** of login attempts or admin actions.
- **No distributed rate limiting** built in — the in-memory limiter is per-process. Inject a shared-store implementation via the `loginRateLimiter` config option if you need one.
- **No session revocation store** — see Sessions above.
- **No password complexity policy** for `seed()`-created admins.

## Development

```bash
pnpm install
pnpm test          # run tests
pnpm typecheck     # type check without emitting
pnpm build         # compile TypeScript
```

## License

MIT

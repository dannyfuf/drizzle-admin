# DrizzleAdmin — Design Decisions

## 1. Admin Users Table

### Approach: Consumer-owned table with enforced contract

The consumer defines their own admin users table in their Drizzle schema. DrizzleAdmin does not own or generate this table. Instead, it enforces a **minimum required shape** through both TypeScript types and runtime validation.

### Required columns

| Property       | SQL Type    | Constraints                  |
|----------------|-------------|------------------------------|
| `id`           | serial      | primary key                  |
| `email`        | text        | unique, not null             |
| `passwordHash` | text        | not null                     |
| `createdAt`    | timestamp   | not null, default `now()`    |
| `updatedAt`    | timestamp   | not null, default `now()`    |

### Enforcement

- **Compile time:** DrizzleAdmin's constructor accepts a generic table type constrained to require the columns above. If the table is missing a required column, TypeScript produces a type error at the call site.
- **Runtime:** On initialization, DrizzleAdmin calls `getTableColumns()` on the provided table and verifies the required property names exist. If any are missing, it throws a descriptive error (e.g., `adminUsers table must have a "passwordHash" column`).

### Extensibility

The consumer can add any additional columns to their table (e.g., `name`, `role`, `lastLoginAt`). DrizzleAdmin ignores columns it doesn't know about. This allows the table to serve double duty for the consumer's own needs without conflicting with the admin panel.

### Example

```ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const adminUsers = pgTable('admin_users', {
  // Required by DrizzleAdmin
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Consumer extensions
  name: text('name'),
  lastLoginAt: timestamp('last_login_at'),
})
```

### Seeding

DrizzleAdmin provides a runtime method for creating the first admin user:

```ts
await admin.seed({ email: 'admin@example.com', password: 'changeme' })
```

This hashes the password internally (bcrypt) and inserts the record. No CLI needed for seeding — the consumer calls this from a setup script.

### No CLI required

A `drizzle-admin init` CLI was considered but deemed unnecessary. Since the contract is enforced via TypeScript + runtime validation, the consumer just needs to define a table with the right columns. The required shape is documented and type-checked — a generator adds little value over copy-pasting from the docs.

### Roles (deferred)

Role-based authorization is out of scope for v1. The schema does not include a `role` column yet. When roles are added later, the contract will be extended with a `role` field, and the consumer will need to add the column + run a migration.

## 2. Multi-Adapter Design

### Approach: Explicit dialect declaration with dialect adapters

DrizzleAdmin supports multiple database dialects. The consumer declares their dialect explicitly in the config. Only PostgreSQL is implemented in v1, but the architecture supports adding MySQL and SQLite later.

### Dialect adapters

Each dialect has an adapter responsible for:

1. **Introspection** — Extracting column metadata from dialect-specific table types (e.g., `PgTable`) into a common `ColumnMeta` type.
2. **Query quirks** — Handling dialect-specific behavior (e.g., `returning()` on Postgres vs separate `SELECT` on MySQL).
3. **Type mapping** — Mapping dialect-specific column types to a common set that views and forms use.

All views, forms, and router logic work exclusively with the common `ColumnMeta` type. They never import dialect-specific Drizzle modules.

### Package structure

```
src/
  dialects/
    types.ts          — ColumnMeta type, DialectAdapter interface
    postgresql.ts     — Postgres adapter (v1)
    mysql.ts          — (future)
    sqlite.ts         — (future)
```

### Why explicit over inferred

The dialect could be inferred from the table type (`PgTable` vs `MySqlTable`), but explicit declaration was chosen because:

- It's more predictable and easier to debug.
- It doesn't couple DrizzleAdmin to Drizzle's internal class hierarchy.
- It matches the pattern Drizzle Kit uses in `drizzle.config.ts`.

## 3. Configuration

### Approach: Dedicated config file, explicit import

DrizzleAdmin uses a dedicated `drizzle-admin.config.ts` file as the single source of truth for all configuration. The consumer imports and passes it to the constructor explicitly.

Auto-discovery (zero-arg constructor) was considered but rejected — resolving the project root at runtime is ambiguous and dynamic `.ts` imports add portability issues.

### Config shape

```ts
// drizzle-admin.config.ts
import { defineConfig } from 'drizzle-admin'
import { db } from './src/db/client'
import { adminUsers } from './src/db/tables/adminUsers'

export default defineConfig({
  db,
  dialect: 'postgresql',
  adminUsers,
  sessionSecret: process.env.ADMIN_SESSION_SECRET!,
  resourcesDir: './src/admin',
})
```

`defineConfig` is an identity function that provides type inference (same pattern as Drizzle Kit and Vite).

### Consumer usage

```ts
import { DrizzleAdmin } from 'drizzle-admin'
import config from './drizzle-admin.config.ts'

const admin = new DrizzleAdmin(config)
app.use('/admin', admin.router())
```

## 4. Resource Registration

### Approach: File-system based, single approach

Resources are registered by placing files in a designated directory (`resourcesDir` from config). DrizzleAdmin scans this directory at startup and generates admin routes for each file found.

There is no programmatic `admin.register()` API. File-based registration is the only approach in v1 to keep the mental model simple.

### Resource file format

Each file exports a resource definition using a `defineResource` helper for type safety:

```ts
// src/admin/cards.ts
import { defineResource } from 'drizzle-admin'
import { cards } from '../db/tables/cards'

export default defineResource(cards)
```

With customization:

```ts
// src/admin/cards.ts
import { defineResource } from 'drizzle-admin'
import { cards } from '../db/tables/cards'

export default defineResource(cards, {
  index: { columns: ['id', 'name', 'code'], perPage: 25 },
  show: { exclude: ['gameAttributes'] },
  memberActions: [
    { name: 'Archive', handler: async (id, db) => { /* ... */ } },
  ],
})
```

### Route path derivation

Routes are derived from the **table's SQL name** (the string passed to `pgTable()`), with underscores replaced by hyphens:

- Table `pgTable('cards', ...)` → `/admin/cards`
- Table `pgTable('sale_orders', ...)` → `/admin/sale-orders`

The filename is irrelevant for routing — only the table's SQL name matters. At startup, DrizzleAdmin errors if two resources resolve to the same route path.

## 5. Authentication

### Approach: Stateless JWT in HTTP-only cookie, kept simple for v1

### Session mechanism

- JWT stored in an **HTTP-only cookie** (not accessible to client-side JavaScript).
- Stateless — no session store, no DB table for sessions, no cleanup jobs.
- All admin routes are protected by middleware that verifies the JWT from the cookie.

### Token expiry

- **24 hours**. After that the admin must re-login.
- Not configurable in v1. Can be exposed in the config later if needed.

### Revocation

- No token revocation in v1. A valid JWT works until it expires.
- Emergency workaround: changing `sessionSecret` in the config invalidates all active sessions.
- Proper revocation (token blacklist, DB-backed sessions) can be added later if needed.

### CSRF protection

- Required because the auth mechanism uses cookies + HTML form submissions.
- Handled internally by DrizzleAdmin using a Hono-compatible CSRF middleware.
- CSRF tokens are embedded in every form and validated server-side on POST/PUT/DELETE requests.
- The consumer does not need to configure anything — DrizzleAdmin wires this in automatically.

### Password hashing

- DrizzleAdmin owns password hashing since it owns the login flow.
- **Bcrypt** is used for hashing on create/update and comparison on login.
- The consumer never handles raw passwords — the `seed()` method and any future admin user management UI hash internally.

### Login flow

1. GET `/admin/login` — renders the login form.
2. POST `/admin/login` — validates email + password against the `adminUsers` table using bcrypt compare. On success, sets a JWT cookie and redirects to `/admin`. On failure, re-renders login with an error message.
3. GET/POST `/admin/logout` — clears the JWT cookie and redirects to `/admin/login`.

## 6. HTTP Server

### Approach: Standalone Hono server on a dedicated port

DrizzleAdmin runs its own HTTP server, separate from the consumer's main application. It does not mount onto the consumer's app as middleware.

### Why standalone

- No framework compatibility issues — DrizzleAdmin owns the entire server.
- No middleware conflicts with the consumer's app.
- Simpler internal architecture — Hono handles routing, middleware, and responses end-to-end.

### Config

The port is declared in the config file:

```ts
// drizzle-admin.config.ts
export default defineConfig({
  db,
  dialect: 'postgresql',
  adminUsers,
  sessionSecret: process.env.ADMIN_SESSION_SECRET!,
  resourcesDir: './src/admin',
  port: 3001,
})
```

### Consumer usage

```ts
import { DrizzleAdmin } from 'drizzle-admin'
import config from './drizzle-admin.config.ts'

const admin = new DrizzleAdmin(config)
admin.start() // starts Hono server on configured port
```

### Production considerations

- The admin panel runs on a separate port (e.g., main app on `:3000`, admin on `:3001`).
- In production, the consumer can use a reverse proxy (e.g., Nginx) to route `/admin` to the admin port, or access it directly on the dedicated port.

## 7. View Layer

### Approach: Server-rendered HTML with Tailwind CDN, shadcn-inspired dark mode

All views are server-rendered using template literal functions. No frontend framework, no build step, no template engine dependency.

### Styling

- **Tailwind CSS via CDN** — loaded via `<script>` tag in the layout. No build step.
- **Dark mode first** — shadcn/ui aesthetic: neutral gray palette, subtle borders (`border` + `border-zinc-800`), rounded corners (`rounded-lg`), soft shadows (`shadow-sm`), good whitespace. Dark background (`bg-zinc-950`), muted foreground text (`text-zinc-300`), accent colors for actions.
- Light mode can be added later.

### Layout structure

```
┌─────────────────────────────────────────────┐
│  Header (logo/title, logged-in admin info)  │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │  Content area                    │
│ (nav)    │                                  │
│          │  [Flash messages]                │
│ - Cards  │  [Action bar]                    │
│ - Sales  │  [View content]                  │
│ - Users  │                                  │
│          │                                  │
├──────────┴──────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

- **Sidebar** — Lists all registered resources (derived from resource files at startup). Each entry links to that resource's index page.
- **Flash messages** — Rendered at the top of the content area as a dismissible banner (shadcn alert style). Implemented via cookies: after an action, a short-lived cookie is set with the message type and text. On the next page load, the cookie is read, the message is rendered, and the cookie is cleared.
- **Dashboard** — The `/admin` root redirects to the first resource's index page. No custom dashboard in v1.

### Views

#### Login

- Centered card with email + password fields and a submit button.
- Error messages displayed inline on failed login.
- No access to sidebar/layout — standalone page.

#### Index (table listing)

```
[Action bar: collection actions — "Export CSV", etc.]
[Table: columns auto-detected from schema, paginated]
[Pagination controls: prev/next, page numbers]
```

- Each row has links to show/edit and a delete button.
- Default pagination: 20 records per page, configurable via `defineResource`.

#### Show (record detail)

```
[Action bar: member actions — "Cancel Order", etc.]
[Detail card: key-value pairs for each column]
[Edit / Delete buttons]
```

#### Form (create + edit, shared)

```
[Action bar: member actions (edit mode only)]
[Form fields: auto-generated from column metadata]
[Submit button: "Create" or "Update"]
```

- A single form template handles both create and edit modes.
- In edit mode, fields are pre-populated with existing values.

### Confirmation for destructive actions

Destructive actions (delete, custom member actions like "Cancel Order") show a **confirmation modal** before executing. Simple HTML/CSS/vanilla JS modal: "Are you sure you want to [action] [record]?" with confirm/cancel buttons. No frontend framework needed.

## 8. CRUD Routes

### Routes per resource

For a resource with table name `sale_orders` (route path: `sale-orders`):

| Method   | Path                       | Action  | Description                     |
|----------|----------------------------|---------|---------------------------------|
| GET      | `/sale-orders`             | index   | Paginated table listing         |
| GET      | `/sale-orders/new`         | new     | Create form                     |
| POST     | `/sale-orders`             | create  | Insert record, redirect to show |
| GET      | `/sale-orders/:id`         | show    | Record detail view              |
| GET      | `/sale-orders/:id/edit`    | edit    | Edit form                       |
| PUT      | `/sale-orders/:id`         | update  | Update record, redirect to show |
| DELETE   | `/sale-orders/:id`         | destroy | Delete record, redirect to index|

### Custom action routes

- **Member actions:** `POST /sale-orders/:id/actions/:actionName` — executes the handler, redirects back to show with a flash message.
- **Collection actions:** `POST /sale-orders/actions/:actionName` — executes the handler. The handler controls the response (redirect, file download, etc.).

### Error handling

- Validation errors re-render the form with error messages and the previously submitted values preserved.
- Record not found returns a 404 page.
- Unexpected errors render a generic error page with the error message in development, and a safe message in production.

### Flash messages after actions

| Action  | Flash type | Message                          |
|---------|------------|----------------------------------|
| create  | success    | "[Resource] created successfully" |
| update  | success    | "[Resource] updated successfully" |
| destroy | success    | "[Resource] deleted successfully" |
| error   | error      | Error description                 |

## 9. Smart Defaults

### Column behavior conventions

DrizzleAdmin applies sensible defaults based on column metadata. These work with zero configuration and can be overridden via `defineResource`.

#### Auto-excluded from forms

- `id` — primary key, auto-generated
- `createdAt` — auto-set by DB default
- `updatedAt` — auto-set by DB default

These columns are shown in index/show views but never appear in create/edit forms.

#### Password columns

- Columns named `password`, `passwordHash`, `password_hash`, or with column type containing "password" are treated as sensitive.
- **Index view:** hidden (column not shown).
- **Show view:** hidden (field not shown).
- **Form view:** rendered as `<input type="password">`.

#### Input type mapping

| Column type / Drizzle type | Form input                          |
|----------------------------|-------------------------------------|
| `text`, `varchar`          | `<input type="text">`               |
| `integer`, `serial`        | `<input type="number">`             |
| `boolean`                  | `<input type="checkbox">`           |
| `timestamp`, `date`        | `<input type="datetime-local">`     |
| `json`, `jsonb`            | `<textarea>` (pretty-printed JSON)  |
| `enum`                     | `<select>` with enum values         |
| password columns           | `<input type="password">`           |

#### Foreign key columns

- Displayed as the raw ID value in index/show views.
- In forms, rendered as a number input (the foreign key ID).
- Future enhancement: show a label from the referenced record, render as a searchable select.

#### Enum columns

- Rendered as `<select>` dropdowns.
- Options are populated from the enum's defined values (read from Drizzle's `enumValues` metadata).

## 10. Custom Actions

### Member actions

Buttons that operate on a single record. Displayed in the **action bar above the content** on show and edit views.

```ts
memberActions: [
  {
    name: 'Cancel Order',
    handler: async (id, db) => {
      await db.update(saleOrders).set({ status: 'cancelled' }).where(eq(saleOrders.id, id))
    },
  },
]
```

- Each action renders as a button in the action bar.
- Destructive actions show a confirmation modal before executing.
- After execution, redirects back to the show page with a flash message.

### Collection actions

Buttons that operate on the resource collection. Displayed in the **action bar above the table** on the index view.

```ts
collectionActions: [
  {
    name: 'Export CSV',
    handler: async (c, db) => {
      // full access to Hono context for custom responses
    },
  },
]
```

- Each action renders as a button in the action bar.
- The handler receives the Hono context (`c`) and the `db` instance, giving full control over the response (redirect, file download, JSON, etc.).

### Action handler signatures

- **Member actions:** `(id: string | number, db: DrizzleDB) => Promise<void>` — DrizzleAdmin handles the redirect and flash message.
- **Collection actions:** `(c: HonoContext, db: DrizzleDB) => Promise<void | Response>` — the handler controls the response entirely.

### How destructive is determined

By default, all member actions show a confirmation modal. A future enhancement could add a `destructive: false` flag to skip confirmation for safe actions.

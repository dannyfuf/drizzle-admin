# Knex Compatibility Phase 1: Backend Abstraction — Plan
> Tracker: ./knex-compatibility-2026-06-07-phase-1-tracker.md
> KEEP THE TRACKER UPDATED. The plan is reference; the tracker is truth. Update it before you commit.

## Summary
This phase prepares DrizzleAdmin for Knex compatibility by isolating the current Drizzle-specific database and table behavior behind internal backend contracts. It does not add a Knex public API. The visible outcome is that existing Drizzle users keep the same configuration, resource declarations, routes, authentication, filters, actions, and CSV export behavior while the internals become backend-neutral enough for Phase 2.

## Sizing call
Phased. The overall Knex compatibility request spans several subsystems and has sequencing risk, so it is split into two shippable phases. This phase is the compatibility-preserving refactor; see `./knex-compatibility-2026-06-07-roadmap.md` for the full roadmap.

## Repository context
- Detected project type: TypeScript ESM package using `pnpm`, `typescript`, and `vitest`.
- Package metadata: `package.json` exports the root package plus `./actions/csv`, `./hono`, and `./express`.
- Deno metadata: `deno.json` publishes the same source exports and maps npm imports for Hono, Drizzle ORM, Jose, bcryptjs, and `@hono/node-server`.
- Current verification scripts: `pnpm typecheck`, `pnpm test`, and `pnpm build` are defined. `pnpm build` currently runs `tsc`; `tsconfig.json` has `noEmit: true`, so it behaves as a TypeScript verification command unless build settings change.
- No lint script exists in `package.json`; do not invent a lint command for this phase unless the implementation adds a lint tool.
- Baseline run on 2026-06-07: `pnpm typecheck` passed.
- Baseline run on 2026-06-07: `pnpm test` passed with 30 test files and 299 tests.
- Current Drizzle coupling appears in `src/config.ts`, `src/types.ts`, `src/DrizzleAdmin.ts`, `src/dialects/types.ts`, `src/dialects/postgresql.ts`, `src/resources/define.ts`, `src/resources/loader.ts`, `src/resources/types.ts`, `src/routes/auth.ts`, `src/routes/crud.ts`, `src/routes/actions.ts`, and `src/actions/csv.ts`.
- Existing plans under `./plans/` are for declared table filters and do not cover Knex compatibility.

## Assumptions
- Existing public Drizzle usage remains source-compatible: `new DrizzleAdmin(defineConfig(...))`, `defineResource(drizzleTable, options)`, and `createCsvExportAction(drizzleTable)` continue to work.
- Phase 1 introduces internal abstractions only; it does not expose a Knex API or add a Knex dependency.
- The package remains named `drizzle-admin` / `@dafu/drizzle-admin` during this work.
- PostgreSQL remains the only supported dialect in this phase.
- Custom action handlers continue to receive the same Drizzle database instance in this phase.

## Out of scope
- Adding a Knex dependency, Knex resource helper, or Knex configuration mode.
- Supporting MySQL or SQLite.
- Renaming `DrizzleAdmin`, the package, or documentation branding.
- Generating database migrations or changing schema requirements.
- Reworking the UI beyond changes required by backend-neutral metadata.

## Affected areas
- `src/config.ts`, `src/types.ts`, `src/DrizzleAdmin.ts`.
- `src/dialects/types.ts`, `src/dialects/postgresql.ts`.
- `src/resources/define.ts`, `src/resources/loader.ts`, `src/resources/types.ts`, `src/resources/filters.ts`.
- `src/routes/auth.ts`, `src/routes/crud.ts`, `src/routes/actions.ts`.
- `src/actions/csv.ts`, `src/index.ts`.
- Existing tests under `src/**/__tests__/*.test.ts`, especially config, DrizzleAdmin, dialect, resource, auth, CRUD, routing integration, and CSV tests.

## Tasks
### P1-T01 — Define backend-neutral contracts
**Intent:** Establish the internal interfaces needed to describe table metadata and database operations without exposing Drizzle-specific objects to route code.
**Touches:** `src/types.ts`, `src/dialects/types.ts`, `src/resources/types.ts`, new internal backend type module.
**Steps:**
- Define an internal backend contract that can count, list, find by id, insert, update, delete, export all records, find an admin by email, and insert an admin user.
- Keep `ColumnMeta` as the shared metadata format used by views, forms, filters, and validation.
- Define how a resource identifies its table, primary key column, SQL table name, route path, display name, and backend-specific table reference.
- Ensure the contract accepts parsed filter intent rather than Drizzle `SQL` objects.
- Keep public exported Drizzle types available for existing users unless they become clearly internal-only.
**Verification:** `pnpm typecheck`; `pnpm test src/routes/__tests__/crud.test.ts src/resources/__tests__/filters.test.ts src/dialects/__tests__/postgresql.test.ts`.
**Done when:** Route, auth, and resource code have a concrete backend contract to depend on, even if only the Drizzle implementation exists.

### P1-T02 — Implement the Drizzle backend adapter
**Intent:** Move existing Drizzle metadata extraction and query behavior into a Drizzle backend implementation that satisfies the new contract.
**Touches:** new Drizzle backend module, `src/dialects/postgresql.ts`, `src/auth/contract.ts`, `src/routes/crud.ts`, `src/routes/auth.ts`.
**Steps:**
- Move Drizzle-specific `getTableColumns`, `getTableName`, `eq`, `and`, `ilike`, and `sql` usage out of generic route setup and into the Drizzle backend implementation.
- Preserve PostgreSQL column metadata mapping from Drizzle columns into `ColumnMeta`.
- Preserve current count, pagination, create, show, edit, update, delete, filter, admin lookup, and seed semantics.
- Preserve current admin users table validation for Drizzle tables.
- Keep unsupported non-PostgreSQL dialect behavior unchanged.
**Verification:** `pnpm typecheck`; `pnpm test src/dialects/__tests__/postgresql.test.ts src/auth/__tests__/contract.test.ts src/routes/__tests__/crud.test.ts`.
**Done when:** Drizzle-specific query and metadata code lives behind the backend implementation rather than inside generic route code.

### P1-T03 — Route CRUD and authentication through the backend contract
**Intent:** Make route construction backend-neutral while preserving current HTTP behavior.
**Touches:** `src/DrizzleAdmin.ts`, `src/routes/crud.ts`, `src/routes/auth.ts`, `src/routes/actions.ts`.
**Steps:**
- Select the Drizzle backend once from the existing config in `DrizzleAdmin` and pass it into auth, CRUD, and action route factories.
- Replace direct table-column and query-builder access in CRUD routes with backend operations.
- Replace direct admin-user lookup in auth routes with a backend admin lookup operation.
- Keep CSRF, flash messages, redirects, base path behavior, and layout rendering unchanged.
- Ensure action routes still call existing action handlers with the current Drizzle database instance.
**Verification:** `pnpm typecheck`; `pnpm test src/routes/__tests__/crud.test.ts src/__tests__/routing-integration.test.ts src/__tests__/build.test.ts`.
**Done when:** Auth and CRUD routes no longer need to know how Drizzle builds queries, and existing route tests still pass.

### P1-T04 — Preserve resource loading and helper behavior
**Intent:** Normalize loaded resources into the backend-neutral resource shape without changing the Drizzle resource API.
**Touches:** `src/resources/define.ts`, `src/resources/loader.ts`, `src/resources/types.ts`, `src/resources/filters.ts`, `src/actions/csv.ts`, `src/index.ts`.
**Steps:**
- Keep `defineResource(drizzleTable, options)` behavior and type inference for existing resource files.
- Have the resource loader derive table name, route path, display name, folder, and column metadata through the Drizzle backend seam.
- Keep duplicate route validation and declared filter validation behavior unchanged.
- Update CSV export to use the backend seam or preserve its existing Drizzle helper while preparing a future backend-specific path.
- Ensure exports from `src/index.ts` remain source-compatible for current users.
**Verification:** `pnpm typecheck`; `pnpm test src/resources/__tests__/define.test.ts src/resources/__tests__/loader.test.ts src/resources/__tests__/filters.test.ts src/actions/__tests__/csv.test.ts`.
**Done when:** Existing resource files load and validate exactly as before while internal resource definitions are no longer Drizzle-only.

### P1-T05 — Lock existing Drizzle behavior with regression tests
**Intent:** Prove the refactor did not change current Drizzle behavior before Phase 2 adds Knex support.
**Touches:** `src/__tests__/DrizzleAdmin.test.ts`, `src/__tests__/config.test.ts`, `src/__tests__/routing-integration.test.ts`, `src/routes/__tests__/crud.test.ts`, `src/actions/__tests__/csv.test.ts`, relevant resource and auth tests.
**Steps:**
- Update mocks to match the new backend seam while keeping assertions focused on user-visible behavior.
- Add or adjust tests that verify existing Drizzle config and resource declarations still work without a new backend option.
- Add regression coverage that unsupported dialects still fail fast as they do today.
- Run the full suite and record results in the tracker.
**Verification:** `pnpm typecheck`; `pnpm test`; `pnpm build`.
**Done when:** The full current suite is green and the tracker records that Drizzle compatibility was preserved.

## Verification
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Lint status: no lint command currently exists in `package.json`; if this phase adds one, run it and record the exact command in the tracker.

## Definition of done
- All `P1-*` tasks are checked off in `./knex-compatibility-2026-06-07-phase-1-tracker.md`.
- Type-check is clean with `pnpm typecheck`.
- Tests pass with `pnpm test`.
- Build verification passes with `pnpm build`.
- Lint status is clean if a lint command is added; otherwise the tracker records that lint is not configured in this repository.
- The tracker reflects reality before the phase is called done.
- Any follow-ups discovered during the refactor are captured in the tracker instead of being silently folded into a task.

## Risks and rollback
- Risk: the new backend contract is too narrow and Phase 2 has to reshape it. Rollback: keep Phase 1 small, avoid public API changes, and revise only internal contracts before starting Phase 2.
- Risk: Drizzle behavior changes accidentally during the refactor. Rollback: revert the backend abstraction commits for Phase 1 and return to direct Drizzle route usage.
- Risk: tests become over-mocked and stop proving route behavior. Rollback: keep routing integration tests focused on HTTP responses and user-visible redirects, not implementation details.
- Risk: public exports change unintentionally. Rollback: compare `src/index.ts`, `package.json` exports, and existing README usage before completing the phase.

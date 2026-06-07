# Knex Compatibility Phase 2: Knex Backend — Plan
> Tracker: ./knex-compatibility-2026-06-07-phase-2-tracker.md
> KEEP THE TRACKER UPDATED. The plan is reference; the tracker is truth. Update it before you commit.

## Summary
This phase adds the user-facing Knex compatibility layer after Phase 1 has isolated Drizzle behavior behind backend contracts. It gives Knex users a supported configuration and resource declaration path, then implements PostgreSQL query behavior for login, seeding, CRUD, filters, actions, and CSV export. Existing Drizzle users remain supported through the original API.

## Sizing call
Phased. This is Phase 2 of a two-phase initiative because Knex support depends on the internal backend seam created in Phase 1. The phase is still a focused implementation stretch, but it touches public API, package metadata, runtime behavior, tests, and docs, so it should not be combined with Phase 1 refactoring.

## Repository context
- Detected project type: TypeScript ESM package using `pnpm`, `typescript`, and `vitest`.
- Current package has `drizzle-orm` in `dependencies` and does not yet include `knex`.
- Current Deno import map in `deno.json` includes Drizzle and runtime dependencies but does not yet include Knex.
- Current verification scripts: `pnpm typecheck`, `pnpm test`, and `pnpm build` are defined. No lint script exists in `package.json`.
- Baseline run on 2026-06-07 before planning: `pnpm typecheck` passed and `pnpm test` passed with 30 test files and 299 tests.
- Current README describes Drizzle-only usage, Drizzle table resources, Drizzle database config, PostgreSQL support, and Drizzle examples.
- Phase 2 should start only after Phase 1 has removed direct Drizzle query-builder usage from generic routes.

## Assumptions
- Knex compatibility means supporting a user-provided Knex instance for PostgreSQL-backed applications.
- This plan does not attempt to support Knex MySQL or SQLite clients because the current admin framework only supports PostgreSQL semantics.
- Knex resources require explicit table metadata because Knex does not provide Drizzle-style table objects with column metadata.
- A new Knex resource helper, such as a Knex-specific `define...Resource` helper, is acceptable and safer than making `defineResource` guess whether an object is a Drizzle table or a Knex table.
- Knex admin users are configured with explicit table and column metadata; this package does not create or migrate the table.
- Existing Drizzle configuration and resource declarations remain supported and documented.
- Custom action handlers may need backend-aware typing so Knex actions receive the Knex instance while Drizzle actions continue to receive the Drizzle database instance.

## Out of scope
- MySQL or SQLite support through Knex.
- Automatic database introspection for Knex resources.
- Migration generation for admin users or resources.
- Renaming the package or `DrizzleAdmin` class.
- Converting existing Drizzle schema definitions into Knex metadata automatically.
- Replacing Drizzle support or changing existing Drizzle examples beyond adding compatibility notes.

## Affected areas
- `package.json`, `pnpm-lock.yaml`, `deno.json`.
- `src/config.ts`, `src/types.ts`, `src/index.ts`.
- Backend modules introduced in Phase 1, plus a new Knex backend module.
- `src/resources/define.ts`, `src/resources/loader.ts`, `src/resources/types.ts`, `src/resources/filters.ts`.
- `src/DrizzleAdmin.ts`, `src/routes/auth.ts`, `src/routes/crud.ts`, `src/routes/actions.ts`.
- `src/actions/csv.ts`.
- Tests under `src/**/__tests__/*.test.ts`, plus new Knex-specific tests.
- `README.md`.

## Tasks
### P2-T01 — Add Knex package surface and config typing
**Intent:** Provide a clear, typed way for users to configure DrizzleAdmin with a Knex instance without breaking existing Drizzle config.
**Touches:** `package.json`, `pnpm-lock.yaml`, `deno.json`, `src/config.ts`, `src/types.ts`, `src/index.ts`, `src/__tests__/config.test.ts`, `src/__tests__/DrizzleAdmin.test.ts`.
**Steps:**
- Add Knex as an optional peer dependency and development dependency for type-checking and tests, unless package policy decides to make it a normal dependency.
- Add the corresponding Deno npm import mapping if source imports require it.
- Convert config typing to a discriminated shape that can distinguish current Drizzle mode from new Knex mode while preserving current Drizzle config calls.
- Add explicit validation errors for unsupported backend/dialect combinations.
- Export the Knex-facing config and database types from `src/index.ts` without removing existing exports.
**Verification:** `pnpm typecheck`; `pnpm test src/__tests__/config.test.ts src/__tests__/DrizzleAdmin.test.ts`; `pnpm build`.
**Done when:** A TypeScript consumer can express both the existing Drizzle config and the new Knex config, and invalid Knex dialect choices fail clearly.

### P2-T02 — Add explicit Knex resource metadata declarations
**Intent:** Let Knex users register resources with enough metadata for forms, filters, validation, routing, and primary-key operations.
**Touches:** `src/resources/define.ts`, `src/resources/types.ts`, `src/resources/loader.ts`, `src/resources/filters.ts`, `src/resources/__tests__/define.test.ts`, `src/resources/__tests__/loader.test.ts`, `src/resources/__tests__/filters.test.ts`.
**Steps:**
- Add a Knex-specific resource declaration helper that accepts table name, column metadata, primary key information, and existing `ResourceOptions`.
- Validate that every declared column has a public name, SQL name, data type, nullability, default status, and primary-key status.
- Derive route path and display name from the table name unless the resource API explicitly allows overrides.
- Ensure declared filters validate against Knex-provided `ColumnMeta` exactly as they do for Drizzle-extracted `ColumnMeta`.
- Preserve duplicate route-path validation across Drizzle and Knex resources.
**Verification:** `pnpm typecheck`; `pnpm test src/resources/__tests__/define.test.ts src/resources/__tests__/loader.test.ts src/resources/__tests__/filters.test.ts`.
**Done when:** Knex resource files can be loaded and validated without Drizzle table objects.

### P2-T03 — Implement PostgreSQL Knex CRUD and filter operations
**Intent:** Execute resource CRUD and index filtering through Knex for PostgreSQL-backed resources.
**Touches:** new Knex backend module, backend contract module, `src/routes/crud.ts`, `src/resources/filters.ts`, `src/routes/__tests__/crud.test.ts`, new Knex backend tests.
**Steps:**
- Implement count, paginated list, find by primary key, insert returning created row, update, delete, and export-all operations using Knex query builders.
- Build text filters with PostgreSQL case-insensitive matching and non-text filters with equality semantics matching current Drizzle behavior.
- Use Knex query builder and identifier handling rather than manual string interpolation for table names, column names, and values.
- Normalize count and returning result shapes so routes can stay backend-neutral.
- Keep form parsing behavior unchanged by continuing to use `ColumnMeta` for value conversion.
**Verification:** `pnpm typecheck`; `pnpm test src/routes/__tests__/crud.test.ts`; `pnpm test`.
**Done when:** The CRUD routes can list, filter, show, create, update, and delete Knex-backed PostgreSQL resources through the backend contract.

### P2-T04 — Implement Knex authentication, seeding, and action behavior
**Intent:** Make login, logout, admin seeding, member actions, and collection actions work for Knex-backed configurations.
**Touches:** `src/DrizzleAdmin.ts`, backend contract module, new Knex backend module, `src/routes/auth.ts`, `src/routes/actions.ts`, `src/resources/types.ts`, `src/auth/__tests__/contract.test.ts`, auth and routing tests.
**Steps:**
- Add Knex admin-users metadata validation for required logical columns: `id`, `email`, `passwordHash`, `createdAt`, and `updatedAt`.
- Implement admin lookup by email and seed-if-missing behavior through the Knex backend.
- Preserve password hashing, password verification, JWT creation, auth cookies, CSRF checks, redirects, and login error messages.
- Update custom action types so Knex resource actions receive the Knex instance and Drizzle resource actions continue to receive the Drizzle database instance.
- Add tests for login success/failure and seed behavior in Knex mode.
**Verification:** `pnpm typecheck`; `pnpm test src/auth/__tests__/contract.test.ts src/__tests__/routing-integration.test.ts src/__tests__/DrizzleAdmin.test.ts`.
**Done when:** Knex configurations can authenticate admins and run custom actions without Drizzle database objects.

### P2-T05 — Add Knex compatibility regression coverage
**Intent:** Prove Knex support works without weakening existing Drizzle coverage.
**Touches:** new Knex tests under `src/**/__tests__`, existing Drizzle regression tests, `vitest.config.ts` if test aliases need adjustment.
**Steps:**
- Add unit tests for Knex metadata validation, resource loading, filter conversion, CRUD operation normalization, auth lookup, and seed behavior.
- Add route-level tests for Knex-backed index, show, new, create, edit, update, delete, login, and logout flows using deterministic mocked Knex behavior or a lightweight query-builder test harness.
- Keep existing Drizzle tests active rather than replacing them with backend-generic tests only.
- Add at least one test that a Drizzle resource and a Knex resource cannot collide on the same route path.
- Record any test harness limitations in the tracker if a real PostgreSQL integration test is deferred.
**Verification:** `pnpm typecheck`; `pnpm test`; `pnpm build`.
**Done when:** The full test suite covers both Drizzle and Knex modes, and no existing Drizzle test is removed without equivalent behavior coverage.

### P2-T06 — Document Knex setup and compatibility boundaries
**Intent:** Make Knex adoption executable for users who were not involved in the implementation.
**Touches:** `README.md`, `package.json`, `deno.json`, any package export documentation added during implementation.
**Steps:**
- Add installation instructions that state whether Knex is an optional peer or normal dependency.
- Add a Knex quick-start showing a Knex config, admin-users metadata, and a resource declaration using explicit column metadata.
- Document that Knex support is PostgreSQL-only in this plan.
- Document required admin users columns and how logical column names map to SQL column names.
- Document custom action handler expectations for Drizzle and Knex resources.
- Preserve existing Drizzle quick-start and examples.
**Verification:** `pnpm typecheck`; `pnpm test`; `pnpm build`; manually review `README.md` examples for consistency with exported API names.
**Done when:** README users can follow a Knex path without reading source code, and compatibility boundaries are explicit.

## Verification
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Lint status: no lint command currently exists in `package.json`; if this phase adds one, run it and record the exact command in the tracker.

## Definition of done
- All `P2-*` tasks are checked off in `./knex-compatibility-2026-06-07-phase-2-tracker.md`.
- Type-check is clean with `pnpm typecheck`.
- Tests pass with `pnpm test`.
- Build verification passes with `pnpm build`.
- Lint status is clean if a lint command is added; otherwise the tracker records that lint is not configured in this repository.
- The tracker reflects reality before the phase is called done.
- Any follow-ups discovered during Knex implementation are captured in the tracker instead of being silently folded into a task.

## Risks and rollback
- Risk: Knex query behavior differs from Drizzle around `count`, `returning`, or filter matching. Rollback: keep Knex support isolated in its backend module and disable the Knex config path while preserving Phase 1 Drizzle behavior.
- Risk: optional dependency metadata makes package installation confusing. Rollback: revert package metadata changes for Knex and keep implementation behind source-only tests until dependency policy is settled.
- Risk: explicit Knex metadata is too verbose for users. Rollback: keep the explicit API as the safe baseline and capture introspection or schema-helper improvements as follow-up work.
- Risk: custom action types become too broad and weaken Drizzle typing. Rollback: split action types by backend mode and keep existing Drizzle action signatures intact.
- Risk: PostgreSQL-only Knex support is mistaken for all-Knex-client support. Rollback: tighten validation and README language so unsupported clients fail early.

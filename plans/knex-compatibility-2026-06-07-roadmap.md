# Knex Compatibility — Roadmap
> Phase plans:
>  - Phase 1: ./knex-compatibility-2026-06-07-phase-1-plan.md · ./knex-compatibility-2026-06-07-phase-1-tracker.md
>  - Phase 2: ./knex-compatibility-2026-06-07-phase-2-plan.md · ./knex-compatibility-2026-06-07-phase-2-tracker.md

## Summary
DrizzleAdmin is currently a server-rendered admin panel for applications that use Drizzle ORM. This initiative adapts the framework so applications that use Knex can also configure admin authentication, CRUD resources, filters, actions, and CSV export. Existing Drizzle users must remain source-compatible while Knex support is introduced. The work is split so the internal backend seam ships first, then the Knex public API and behavior are added on top of that seam.

## Why this is phased
This work crosses configuration typing, resource loading, table metadata extraction, authentication, seeding, CRUD query execution, filter query construction, custom actions, CSV export, package metadata, Deno imports, tests, and documentation. The current code has direct Drizzle dependencies in those paths, so adding Knex in one change would mix a compatibility-preserving refactor with new backend behavior. Phase 1 creates a shippable no-public-API-change backend abstraction. Phase 2 adds Knex compatibility using that abstraction.

## Phase list
### Phase 1 — Backend Abstraction for Existing Drizzle Behavior
**Goal:** Move the current Drizzle-specific metadata and query behavior behind internal backend interfaces without changing the public Drizzle API.
**Shippable state at end of phase:** Existing DrizzleAdmin users see no public API or behavior change, and the current TypeScript and Vitest suites remain green.
**Plan:** ./knex-compatibility-2026-06-07-phase-1-plan.md
**Tracker:** ./knex-compatibility-2026-06-07-phase-1-tracker.md

### Phase 2 — Knex Backend and Public Compatibility API
**Goal:** Add Knex configuration, resource declarations, query execution, authentication, tests, and documentation using the backend seams from Phase 1.
**Shippable state at end of phase:** A PostgreSQL-backed Knex app can use DrizzleAdmin with explicit table metadata for admin users and CRUD resources.
**Plan:** ./knex-compatibility-2026-06-07-phase-2-plan.md
**Tracker:** ./knex-compatibility-2026-06-07-phase-2-tracker.md

## Seams between phases
- Phase 1 owns the internal backend contract. Phase 2 consumes that contract and should not reintroduce Drizzle-specific query logic into routes.
- `ColumnMeta` remains the shared UI/form/filter metadata shape. Drizzle resources populate it by extracting Drizzle table metadata; Knex resources populate it from explicit user declarations.
- Drizzle resource files continue to use `defineResource(table, options)`. Phase 2 may add a new Knex-specific helper rather than overloading Drizzle table behavior silently.
- Phase 1 preserves the current `DrizzleAdmin` class and package name. Any broader product rename is intentionally outside this roadmap.
- Phase 2 targets Knex with PostgreSQL first because the current framework only supports PostgreSQL semantics and uses PostgreSQL-specific behavior such as `ILIKE` and `RETURNING`.

## Cross-phase risks
- Drizzle assumptions may leak through the backend contract if routes keep table objects or Drizzle SQL values in their signatures.
- Knex has no Drizzle-style table metadata, so incomplete explicit metadata could make forms, filters, or admin-user validation unsafe.
- Optional dependency handling can accidentally force Drizzle users to install Knex or force Knex users to install Drizzle-only packages.
- Tests that only mock happy-path query chains may miss query-builder behavior differences around `returning`, count result shapes, and identifier handling.
- Existing custom action handler types currently receive a Drizzle database instance; widening that contract needs careful typing so existing actions still compile.

## Suggested order
- Complete Phase 1 and verify the full current suite with `pnpm typecheck`, `pnpm test`, and `pnpm build` before starting any Knex API work.
- Start Phase 2 only after routes no longer import Drizzle query builders directly.
- In Phase 2, add the public Knex shape before implementing queries so tests can lock the intended user-facing API.
- Treat documentation as part of Phase 2 completion because users cannot safely adopt Knex support without explicit metadata examples and compatibility boundaries.

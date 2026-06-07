# Knex Compatibility Phase 2: Knex Backend — Tracker
> Plan: ./knex-compatibility-2026-06-07-phase-2-plan.md
> READ ME FIRST. Update this file as you work. The plan is reference; this tracker is the source of truth for state. If reality diverges from the plan, update both.

## Working agreement
- Check the kickoff box below before starting.
- Move tasks through: [ ] todo → [~] in progress → [x] done. One task in progress at a time.
- After each task: tick its box, paste the verification command output (or a one-line "verified: <how>"), and commit.
- If you discover work the plan missed, add a new task with the next ID. Never silently expand an existing task.
- Definition of done is not met until every box is ticked and this tracker matches reality.

## Kickoff
- [x] I have read the plan end to end.
- [x] I have run the project-wide verification commands before starting Phase 2 implementation. The tree was not clean because Phase 1 changes and `plans/` were already present. Latest pre-Phase-2 commands from the Phase 1 handoff passed: `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [x] I am ready to start.

## Tasks
- [x] P2-T01 — Add Knex package surface and config typing. Verified: `pnpm typecheck`, `pnpm test src/__tests__/config.test.ts src/__tests__/DrizzleAdmin.test.ts`, and `pnpm build` passed.
- [x] P2-T02 — Add explicit Knex resource metadata declarations. Verified: `pnpm test src/resources/__tests__/define.test.ts src/resources/__tests__/loader.test.ts src/resources/__tests__/filters.test.ts` passed.
- [x] P2-T03 — Implement PostgreSQL Knex CRUD and filter operations. Verified: `pnpm test src/backends/__tests__/knex.test.ts src/__tests__/knex-routing-integration.test.ts src/routes/__tests__/crud.test.ts` passed.
- [x] P2-T04 — Implement Knex authentication, seeding, and action behavior. Verified: `pnpm test src/auth/__tests__/contract.test.ts src/__tests__/DrizzleAdmin.test.ts src/__tests__/knex-routing-integration.test.ts` passed.
- [x] P2-T05 — Add Knex compatibility regression coverage. Verified: full `pnpm test` passed with 32 files and 324 tests.
- [x] P2-T06 — Document Knex setup and compatibility boundaries. Verified: README updated and final `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.

## Notes / decisions log
- 2026-06-07: Added `backend: 'knex'` config mode while preserving existing Drizzle configs without a required `backend` field.
- 2026-06-07: Added Knex as an optional peer dependency and a dev dependency for type-checking/tests.
- 2026-06-07: Added explicit Knex table metadata helpers: `defineKnexTable`, `defineKnexAdminUsers`, and `defineKnexResource`.
- 2026-06-07: Knex support is PostgreSQL-only and validates unsupported Knex dialects at construction time.
- 2026-06-07: Knex rows are normalized from SQL column names to logical `ColumnMeta.name` keys before reaching views, routes, actions, and CSV export.
- 2026-06-07: Custom actions preserve backend-specific db instances: Drizzle resources receive the Drizzle DB, Knex resources receive the Knex instance.
- 2026-06-07: Tests use deterministic Knex query-builder fakes rather than a live PostgreSQL integration database.
- 2026-06-07: No lint command exists in `package.json`; no lint was run.
- 2026-06-07: No commits were created because the user did not request a commit.

## Follow-ups
- Consider adding a real PostgreSQL integration test matrix for Knex count/returning behavior in a future phase.

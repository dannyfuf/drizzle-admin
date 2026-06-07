# Knex Compatibility Phase 1: Backend Abstraction — Tracker
> Plan: ./knex-compatibility-2026-06-07-phase-1-plan.md
> READ ME FIRST. Update this file as you work. The plan is reference; this tracker is the source of truth for state. If reality diverges from the plan, update both.

## Working agreement
- Check the kickoff box below before starting.
- Move tasks through: [ ] todo → [~] in progress → [x] done. One task in progress at a time.
- After each task: tick its box, paste the verification command output (or a one-line "verified: <how>"), and commit.
- If you discover work the plan missed, add a new task with the next ID. Never silently expand an existing task.
- Definition of done is not met until every box is ticked and this tracker matches reality.

## Kickoff
- [x] I have read the plan end to end.
- [x] I have run the project-wide verification commands once before implementation to confirm the baseline. `pnpm typecheck` passed; `pnpm test` passed with 30 files and 299 tests. The tree was not clean because `plans/` was already untracked.
- [x] I am ready to start.

## Tasks
- [x] P1-T01 — Define backend-neutral contracts. Verified: `pnpm typecheck` passed.
- [x] P1-T02 — Implement the Drizzle backend adapter. Verified: `pnpm typecheck` passed and `pnpm test src/routes/__tests__/crud.test.ts src/actions/__tests__/csv.test.ts src/__tests__/routing-integration.test.ts src/__tests__/DrizzleAdmin.test.ts src/__tests__/build.test.ts` passed.
- [x] P1-T03 — Route CRUD and authentication through the backend contract. Verified: route modules no longer import `drizzle-orm`; targeted route/build tests passed.
- [x] P1-T04 — Preserve resource loading and helper behavior. Verified: `pnpm test src/resources/__tests__/loader.test.ts src/resources/__tests__/define.test.ts src/resources/__tests__/filters.test.ts` passed.
- [x] P1-T05 — Lock existing Drizzle behavior with regression tests. Verified: `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. Full test result: 30 files and 300 tests passed.

## Notes / decisions log
- 2026-06-07: Added internal `AdminBackend` and `DrizzleBackend` seams without adding a Knex public API or dependency.
- 2026-06-07: Resource loading now asks the backend to resolve table name, route path, display name, primary key, and column metadata. Loaded resources carry resolved `columns` and `primaryKey`.
- 2026-06-07: CRUD and auth routes now call backend operations for count/list/find/insert/update/delete/admin lookup instead of building Drizzle SQL directly.
- 2026-06-07: Existing custom action handlers still receive the Drizzle database instance via `backend.actionDatabase` in this phase.
- 2026-06-07: No commits were created because the user did not request a commit.

## Follow-ups
- None.

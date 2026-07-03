# Login authentication bypass via CSRF-token replay — Tracker
> Plan: ./login-auth-bypass-2026-07-03-plan.md
> READ ME FIRST. Update this file as you work. The plan is reference; this tracker is the source of truth for state. If reality diverges from the plan, update both.

## Working agreement
- Check the kickoff box below before starting.
- Move tasks through: [ ] todo → [~] in progress → [x] done. One task in progress at a time.
- After each task: tick its box, paste the verification command output (or a one-line "verified: <how>"), and commit.
- If you discover work the plan missed, add a new task with the next ID. Never silently expand an existing task.
- Definition of done is not met until every box is ticked and this tracker matches reality.

## Kickoff
- [x] I have read the plan end to end.
- [x] I have run the project-wide verification commands once on a clean tree to confirm a green baseline (`pnpm typecheck && pnpm test`).
- [x] I am ready to start.

Baseline (2026-07-03): `pnpm install` needed first (node_modules missing). `pnpm typecheck` clean; `pnpm test` → 34 files, 337 tests passing.

## Tasks
- [x] T01 — Reproduce the bypass with a failing test
- [x] T02 — Add a token-type claim and validate it in the JWT layer
- [x] T03 — Route CSRF and session flows through their own token type
- [x] T04 — Invert the reproduction test into a regression assertion
- [x] T05 — Update existing auth tests to the new contract

## Notes / decisions log
(Append-only. Date-stamp entries. Capture anything that surprised you or that future-you will want.)
- 2026-07-03 — Root cause: `verifyToken` accepts any HS256 JWT signed with `sessionSecret`; CSRF tokens (`adminId: 0`) are minted with the same secret and no type claim, so a `_csrf` cookie replays as `admin_session`. Fix = distinct token-type claim validated per flow, plus algorithm pinning.
- 2026-07-03 — No linter configured in package.json; type-check + vitest are the gate. `deno.json` present but not the driving toolchain.
- 2026-07-03 — T01: added `src/auth/__tests__/middleware.test.ts` reproducing the bypass. A `_csrf` token in the `admin_session` cookie reaches the protected handler (200). Verified green against vulnerable code: `pnpm test src/auth/__tests__/middleware.test.ts` → 1 passed.
- 2026-07-03 — Design: token type carried as JWT `aud` (audience) claim (`session` / `csrf`), verified with jose's built-in `audience` option plus `algorithms: ['HS256']` pinning. `createToken`/`verifyToken` gain a required token-type arg.
- 2026-07-03 — Working on branch `bugfix/login-auth-bypass-csrf-replay` (was on `main`).
- 2026-07-03 — T02: `createToken`/`verifyToken` take a required `TokenType` (`session`|`csrf`). Type stored in `aud`; `verifyToken` passes `{ algorithms: ['HS256'], audience: expectedType }` to jose, so wrong type or non-HS256 → null.
- 2026-07-03 — T03: `generateCsrfToken`/`validateCsrf` mint+verify as `csrf`; middleware verifies `admin_session` as `session` (clears cookie + redirects on mismatch, reusing the existing invalid-token path); `routes/auth.ts` login issues `session`. Cookie names/paths/flags unchanged.
- 2026-07-03 — T04+T05: middleware test inverted to assert a csrf token is rejected as a session (302 → /login) + cookie cleared, plus positive session-accepted case. jwt.test.ts now covers both cross-type rejections. Integration tests (knex/persistence/routing) updated to mint `session` tokens. csrf.test.ts unchanged (signatures stable).
- 2026-07-03 — Verification: `pnpm typecheck` clean; `pnpm test` → 35 files, 342 passed (was 34/337 — +middleware.test.ts, +2 jwt cases); `pnpm build` (tsc) clean. No linter configured — N/A.

## Follow-ups
(Things discovered mid-flight that are out of scope for this plan. Each gets a one-line description.)
- Login user-enumeration via timing: POST /login returns immediately on unknown email but runs bcrypt on known email, leaking account existence. Consider a constant-time path (dummy bcrypt compare) — separate fix.

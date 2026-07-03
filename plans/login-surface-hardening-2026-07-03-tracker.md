# Login surface hardening — Tracker
> Plan: ./login-surface-hardening-2026-07-03-plan.md
> READ ME FIRST. Update this file as you work. The plan is reference; this tracker is the source of truth for state. If reality diverges from the plan, update both.

## Working agreement
- Check the kickoff box below before starting.
- Move tasks through: [ ] todo → [~] in progress → [x] done. One task in progress at a time.
- After each task: tick its box, paste the verification command output (or a one-line "verified: <how>"), and commit.
- If you discover work the plan missed, add a new task with the next ID. Never silently expand an existing task.
- Definition of done is not met until every box is ticked and this tracker matches reality.

## Kickoff
- [x] I have read the plan end to end.
- [x] I have run the project-wide verification commands once on a clean tree to confirm a green baseline (`pnpm typecheck && pnpm test` — expect 342 tests / 35 files passing). Verified 2026-07-03: 342 tests / 35 files, typecheck clean.
- [x] I am ready to start.

## Tasks
- [x] T01 — Enforce sessionSecret strength at construction — verified: `pnpm typecheck && pnpm test` → 347 tests / 35 files passing. Note: test fixtures across 4 suites used sub-32-char secrets and were lengthened.
- [x] T02 — Strictly validate the login request body — verified: `pnpm typecheck && pnpm test` → 359 tests / 36 files passing. Note: the old distinct "Email and password are required." message was collapsed into the generic "Invalid email or password." so no validation branch is distinguishable.
- [x] T03 — Close the email-enumeration timing oracle and the null-hash crash — verified: `pnpm typecheck && pnpm test` → 377 tests / 37 files passing. Used the bcrypt-spy approach (exactly one compare per failure branch) instead of wall-clock timing, as the plan preferred. Error pages compared byte-identical after normalizing the per-response CSRF token.
- [x] T04 — Throttle login attempts (landed before T03 per the suggested order) — verified: `pnpm typecheck && pnpm test` → 372 tests / 37 files passing. Limiter interface accepts `identifier: string | null`; when the runtime exposes no client IP (and no trusted proxy header), only the per-email limit applies — avoids a shared "unknown" bucket that would let one attacker lock out everyone.
- [x] T05 — Make logout POST-only with CSRF validation — verified: `pnpm typecheck && pnpm test` → 380 tests / 37 files passing. Layout now requires `csrfToken` (all 4 call sites in crud.ts already minted one); GET /logout redirects to app root without touching the session.
- [x] T06 — Fix cookie-clear path mismatch and add no-store to auth pages — verified: `pnpm typecheck && pnpm test` → 382 tests / 37 files passing. Refactored the login-render repetition into a `renderLoginPage` helper that always sets `Cache-Control: no-store`.
- [x] T07 — Give CSRF tokens per-issue uniqueness — verified: `pnpm typecheck && pnpm test` → 385 tests / 37 files passing. `createToken` gained an optional `{ jti }` options bag; session tokens are unchanged (no jti unless passed).
- [x] T08 — Consolidate security regression tests and document the security model — verified: `pnpm typecheck && pnpm test` → 391 tests / 38 files passing. `login-hardening.test.ts` is the attacker checklist (replay, aud confusion, brute force, enumeration, GET logout, weak secret); README gained the "Security model" section with guarantees and non-goals.

## Notes / decisions log
(Append-only. Date-stamp entries. Capture anything that surprised you or that future-you will want.)

- 2026-07-03 — Plan created from the post-bypass security review. The token-type bypass itself was already fixed in `a423686` (see ./login-auth-bypass-2026-07-03-plan.md); this plan is the follow-on hardening pass.
- 2026-07-03 — Suggested landing order: T01 → T02 → T03+T04 (land together or T04 first; T03 adds a bcrypt compare to unknown-email requests that T04 bounds) → T05 → T06 → T07 → T08.
- 2026-07-03 — Implementation complete, landed in order T01 → T02 → T04 → T03 → T05 → T06 → T07 → T08, one commit per task on main. Final state: 391 tests / 38 files, typecheck clean (baseline was 342 / 35).
- 2026-07-03 — Surprises worth remembering: (a) four test suites used sub-32-char session secrets and had to be updated for T01; (b) the rate limiter takes `identifier: string | null` — when the runtime exposes no client IP and no trusted proxy header, only the per-email limit applies, deliberately avoiding a shared "unknown" bucket that would let one attacker 429 everyone; (c) "byte-identical error pages" in T03 is asserted after normalizing the per-response CSRF token, the only legitimate difference; (d) T02 collapsed the old "Email and password are required." message into the generic error so no validation branch is distinguishable.

## Follow-ups
(Things discovered mid-flight that are out of scope for this plan. Each gets a one-line description.)

- Server-side session revocation (token denylist or session store) so logout/compromise actually invalidates tokens before the 24h expiry.
- Pluggable persistent rate-limit store (Redis) for multi-process deployments.
- MFA/TOTP support for admin accounts.
- Audit logging of login attempts and admin actions.
- Password complexity policy for `seed()`-created admins.

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
- [ ] T03 — Close the email-enumeration timing oracle and the null-hash crash
- [ ] T04 — Throttle login attempts
- [ ] T05 — Make logout POST-only with CSRF validation
- [ ] T06 — Fix cookie-clear path mismatch and add no-store to auth pages
- [ ] T07 — Give CSRF tokens per-issue uniqueness
- [ ] T08 — Consolidate security regression tests and document the security model

## Notes / decisions log
(Append-only. Date-stamp entries. Capture anything that surprised you or that future-you will want.)

- 2026-07-03 — Plan created from the post-bypass security review. The token-type bypass itself was already fixed in `a423686` (see ./login-auth-bypass-2026-07-03-plan.md); this plan is the follow-on hardening pass.
- 2026-07-03 — Suggested landing order: T01 → T02 → T03+T04 (land together or T04 first; T03 adds a bcrypt compare to unknown-email requests that T04 bounds) → T05 → T06 → T07 → T08.

## Follow-ups
(Things discovered mid-flight that are out of scope for this plan. Each gets a one-line description.)

- Server-side session revocation (token denylist or session store) so logout/compromise actually invalidates tokens before the 24h expiry.
- Pluggable persistent rate-limit store (Redis) for multi-process deployments.
- MFA/TOTP support for admin accounts.
- Audit logging of login attempts and admin actions.
- Password complexity policy for `seed()`-created admins.

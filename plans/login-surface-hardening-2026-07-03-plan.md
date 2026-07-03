# Login surface hardening — Plan
> Tracker: ./login-surface-hardening-2026-07-03-tracker.md
> KEEP THE TRACKER UPDATED. The plan is reference; the tracker is truth. Update it before you commit.

## Summary

drizzle-admin is an embeddable admin panel that exposes real database data behind a single email/password login. A security review (2026-07-03, after the CSRF-replay bypass was fixed in `a423686`) found the remaining login surface functional but soft: no brute-force throttling, an email-enumeration timing oracle, no minimum strength on the HS256 `sessionSecret` that every token depends on, GET-triggered logout, a crash path on null password hashes, and loose request-body handling. This plan hardens each of those, adds regression tests for every fix, and documents the resulting security model so library consumers know exactly what they are getting.

## Sizing call

**Standard.** All work lives in one subsystem (`src/auth/`, `src/routes/auth.ts`, plus small touches in `src/DrizzleAdmin.ts`, `src/config.ts`, and views). No migrations, no intermediate shippable states, no cross-team sequencing — a few days of focused work. Phasing was considered and rejected: the tasks are independent enough to land as a sequence of small commits within one stretch.

## Repository context

- TypeScript library (`package.json`, `"type": "module"`), Hono-based HTTP layer, `jose` for JWTs, `bcryptjs` for password hashing.
- Test runner: Vitest — `pnpm test` (runs `vitest run`). Full suite currently green: 342 tests, 35 files.
- Type check: `pnpm typecheck` (runs `tsc --noEmit`).
- No lint script exists in `package.json`; lint is out of the verification loop for this repo.
- Auth code: `src/auth/jwt.ts` (typed HS256 tokens, `aud: session|csrf`), `src/auth/middleware.ts` (cookie → `verifyToken(…, 'session')`), `src/auth/csrf.ts` (double-submit signed CSRF), `src/auth/password.ts` (bcrypt, 12 rounds), `src/routes/auth.ts` (login/logout handlers), `src/views/login.ts` (login page), `src/views/layout.ts` (has the `<a href=…/logout>` link), `src/DrizzleAdmin.ts` (config intake + route mounting).
- CRUD routes (`src/routes/crud.ts`) already mint/validate CSRF tokens for mutating forms — reuse that machinery for POST logout.
- Prior related plan: `./login-auth-bypass-2026-07-03-plan.md` (completed — fixed the token-type bypass). This plan is the follow-on hardening pass, not a resume of that one.

## Assumptions

- Rate limiting may be in-memory (per-process `Map`). The library targets single-process deployments; a shared store (Redis) is explicitly out of scope, but the limitation must be documented and the limiter must be injectable/configurable enough to swap later.
- Enforcing a minimum `sessionSecret` length is an acceptable breaking change for a 0.x library (constructor throws on weak secrets). Consumers with short secrets must rotate; existing sessions are already invalidated on secret rotation by design.
- Email lookup semantics stay byte-exact (no lowercasing on login) — normalization would silently change who can log in against existing data. Only `trim()` is applied.
- "Deep and strict validation" from the request maps to: strict body shape validation, secret strength enforcement, timing-uniform failure paths, throttling, and CSRF/logout tightening — not MFA, password-complexity policies, or audit logging (listed as follow-ups).

## Out of scope

- Server-side session revocation / token denylist (stateless JWT design tradeoff — documented, not changed).
- MFA / TOTP.
- Password complexity policy for `seed()`-created admins.
- Persistent or distributed rate-limit storage (Redis etc.).
- Audit logging of login attempts.
- CAPTCHA integration.

## Affected areas

- `src/DrizzleAdmin.ts` — constructor-time secret validation.
- `src/config.ts` — new optional rate-limit config, doc comments.
- `src/routes/auth.ts` — input validation, timing-uniform failures, throttling hook, POST-only logout.
- `src/auth/password.ts` — dummy-compare helper for unknown accounts.
- `src/auth/csrf.ts` — per-token random `jti`.
- `src/auth/middleware.ts` — basePath-aware cookie clearing.
- `src/auth/rate-limit.ts` — new module.
- `src/views/login.ts`, `src/views/layout.ts` — no-store headers wiring, logout form.
- `src/auth/__tests__/`, `src/__tests__/` — new and updated tests.
- `README.md` — security model section.

## Tasks

### T01 — Enforce sessionSecret strength at construction
- **Intent:** Fail fast on weak secrets, since every session and CSRF token derives from this single HS256 key.
- **Touches:** src/DrizzleAdmin.ts, src/config.ts, src/__tests__/
- **Steps:**
  - In the `DrizzleAdmin` constructor (alongside the existing basePath validation), reject a `sessionSecret` that is missing, not a string, or shorter than 32 characters, with an error message that says what to generate (e.g. 32+ random bytes) — never echo the secret back.
  - Document the requirement on the `sessionSecret` field in `src/config.ts` and in the class-level JSDoc example (the example currently shows `sessionSecret: "secret"`, which would now throw — update it).
  - Add constructor tests: too-short secret throws, 32-char secret passes, error message does not contain the secret value.
- **Verification:** `pnpm typecheck && pnpm test`
- **Done when:** Constructing `DrizzleAdmin` with a sub-32-char secret throws before any route is mounted, and tests prove it.

### T02 — Strictly validate the login request body
- **Intent:** Reject malformed login submissions before any DB or bcrypt work, closing type-confusion and resource-abuse paths through `parseBody`.
- **Touches:** src/routes/auth.ts, src/auth/__tests__/
- **Steps:**
  - Replace the bare `body.email as string` / `body.password as string` casts with real checks: both fields must be plain non-empty strings (Hono's `parseBody` returns arrays for duplicate fields and `File` objects for uploads — both must be rejected, not coerced).
  - Enforce length caps before hashing: email ≤ 254 chars, password ≤ 256 chars (bcrypt only reads 72 bytes; the cap bounds CPU spent on oversized input). Over-limit input gets the same generic "Invalid email or password." response — no distinct error that leaks validation internals.
  - `trim()` the email; do not change its case.
  - Add handler tests: array-valued fields rejected, over-length fields rejected, all failures return the generic error with a fresh CSRF token.
- **Verification:** `pnpm typecheck && pnpm test`
- **Done when:** No non-string or oversized value reaches `findAdminByEmail` or `verifyPassword`, proven by tests.

### T03 — Close the email-enumeration timing oracle and the null-hash crash
- **Intent:** Make login failure take the same time and shape whether the email exists, doesn't exist, or has a broken stored hash.
- **Touches:** src/auth/password.ts, src/routes/auth.ts, src/auth/__tests__/
- **Steps:**
  - Add a module-level constant dummy bcrypt hash (pre-generated at 12 rounds) and a `verifyPassword`-compatible path that compares against it when no admin row is found, so the "unknown email" branch costs one bcrypt compare like the "known email" branch (~390ms today vs ~1ms).
  - Guard the stored hash before comparing: if `admin.passwordHash` is not a non-empty string, run the dummy compare and fail with the generic error instead of letting `bcryptjs` throw `Illegal arguments` and 500 (verified crash path at src/routes/auth.ts:62).
  - Add tests: unknown email and known email both return the generic error; a row with a null/empty `passwordHash` returns the generic error, not a 500; a coarse timing assertion (e.g. unknown-email path takes ≥ some floor, or both paths invoke bcrypt exactly once via a spy — prefer the spy, wall-clock timing tests flake).
- **Verification:** `pnpm typecheck && pnpm test`
- **Done when:** Both failure branches perform exactly one bcrypt compare and return byte-identical error pages, and a null hash can no longer 500 the login route.

### T04 — Throttle login attempts
- **Intent:** Stop unbounded credential guessing and blunt the CPU-exhaustion vector (each guess costs the server a 12-round bcrypt).
- **Touches:** src/auth/rate-limit.ts (new), src/routes/auth.ts, src/config.ts, src/DrizzleAdmin.ts, src/auth/__tests__/
- **Steps:**
  - Create an in-memory fixed-window limiter with two keys checked independently: per-identifier (client IP, best-effort from the connection info / `x-forwarded-for` only when explicitly trusted via config) and per-email (so a distributed attack on one account is still caught). Suggested defaults: 5 failures per identifier per minute, 10 failures per email per 15 minutes; expose both as optional config with these defaults.
  - Count only *failed* attempts; clear the email counter on successful login. Prune expired entries on write so the map cannot grow unboundedly.
  - When limited, short-circuit before DB/bcrypt work and re-render the login page with a generic "Too many attempts, try again later." message and HTTP 429; do not reveal which key tripped.
  - Wire the limiter through `createAuthRoutes` config; keep the module dependency-free so a consumer-supplied store can replace it later (accept the limiter as an interface, default to the in-memory one).
  - Document the single-process limitation in the config JSDoc.
  - Add tests: N failures trips the limit, success resets the email counter, window expiry unlocks, limited requests never invoke the backend or bcrypt (spy).
- **Verification:** `pnpm typecheck && pnpm test`
- **Done when:** Sustained wrong-password submissions get 429s without touching bcrypt or the DB, and tests cover trip/reset/expiry.

### T05 — Make logout POST-only with CSRF validation
- **Intent:** Remove the forced-logout CSRF vector (`app.all('/logout')` currently honors a cross-site GET/img request).
- **Touches:** src/routes/auth.ts, src/views/layout.ts, src/routes/crud.ts (call sites that render the layout), src/__tests__/
- **Steps:**
  - Change the logout route from `app.all` to `app.post` and validate the CSRF token with the existing `validateCsrf` before clearing the cookie; on CSRF failure redirect to the app root rather than clearing.
  - Replace the `<a href=…/logout>` link in `src/views/layout.ts` with a minimal inline POST form (button styled as the current link) that includes `csrfInput(...)`. The layout will need the CSRF token passed in — CRUD pages already mint one via `setCsrfCookie`; thread that token through the layout props and update every layout call site.
  - Keep a GET `/logout` handler that redirects to the app root without clearing anything (so old bookmarks don't 404 but also don't log anyone out).
  - Update the routing-integration tests that touch logout; add tests: GET does not clear the session cookie, POST without CSRF does not clear it, POST with CSRF clears it and redirects to login.
- **Verification:** `pnpm typecheck && pnpm test`
- **Done when:** Only a CSRF-bearing POST can terminate a session, and the sign-out button still works in every rendered page.

### T06 — Fix cookie-clear path mismatch and add no-store to auth pages
- **Intent:** Make cookie clearing actually effective when `basePath` is set, and keep login/admin HTML out of shared caches.
- **Touches:** src/auth/middleware.ts, src/routes/auth.ts, src/auth/__tests__/
- **Steps:**
  - In `authMiddleware`, clear the rejected session cookie with the same path used by `setAuthCookie` (basePath-aware) instead of the hardcoded `"/"` (src/auth/middleware.ts:22) — reuse `clearAuthCookie` rather than the inline `setCookie`.
  - Add `Cache-Control: no-store` to the login page responses (GET and failed POST re-renders).
  - Add tests: with a basePath configured, the invalid-token redirect clears the cookie at the basePath; login responses carry `no-store`.
- **Verification:** `pnpm typecheck && pnpm test`
- **Done when:** An invalid session cookie under a basePath install is genuinely removed by the browser, and login HTML is never cacheable.

### T07 — Give CSRF tokens per-issue uniqueness
- **Intent:** Stop all CSRF tokens in a validity window from being interchangeable (today every token has the identical payload `{adminId: 0, email: 'csrf'}`).
- **Touches:** src/auth/csrf.ts, src/auth/jwt.ts, src/auth/__tests__/
- **Steps:**
  - Add a random `jti` claim (crypto-random, e.g. 16 bytes hex) when minting CSRF tokens, via a small extension to `createToken` or a claims pass-through — do not weaken the existing `aud` typing.
  - Keep validation as-is (signature + `aud: csrf` + double-submit equality); the uniqueness makes tokens non-interchangeable across forms/tabs and lays the groundwork for future single-use enforcement without adding state now.
  - Add tests: two generated CSRF tokens differ; a token still validates round-trip; session tokens remain unaffected.
- **Verification:** `pnpm typecheck && pnpm test`
- **Done when:** No two issued CSRF tokens are byte-identical and the existing CSRF flow still passes.

### T08 — Consolidate security regression tests and document the security model
- **Intent:** Lock every hardening in with an explicit attack-shaped test file and tell library consumers what the auth actually guarantees.
- **Touches:** src/auth/__tests__/login-hardening.test.ts (new), README.md
- **Steps:**
  - Create one integration-style test file that exercises the login surface as an attacker: CSRF-token-as-session replay (exists — reference it), no-aud/wrong-aud signed tokens rejected, brute-force gets 429, unknown vs known email indistinguishable, GET logout inert, weak secret refused at construction. Reuse existing coverage where it exists; the file may re-export/point to it rather than duplicate.
  - Add a "Security model" section to `README.md`: secret requirements (≥32 chars, rotation invalidates sessions), stateless 24h JWT sessions (no server-side revocation — logout clears the cookie only), in-memory rate limiting caveat for multi-process deployments, CSRF scheme, and the recommendation to run behind HTTPS (secure cookies are production-gated on `NODE_ENV`).
  - List deliberate non-goals (MFA, audit logging, distributed rate limiting) so consumers can make an informed call.
- **Verification:** `pnpm typecheck && pnpm test`
- **Done when:** One test file reads as the login-surface threat checklist and the README states the security guarantees and their limits.

## Verification

Run from the repo root:

- `pnpm typecheck`
- `pnpm test`

There is no lint script in this repo. The full suite must stay green (baseline: 342 tests / 35 files before this work).

## Definition of done

- [x] All tasks T01–T08 checked off in the tracker.
- [x] `pnpm typecheck` clean.
- [x] `pnpm test` passing (baseline suite plus all new hardening tests — 391 tests / 38 files).
- [x] Tracker reflects reality — statuses, notes, and any added tasks match the code as committed.
- [x] README security-model section merged.
- [x] Follow-ups discovered mid-flight captured in the tracker's Follow-ups section (candidates already known: session revocation store, MFA, audit logging, distributed rate limiting).

## Risks and rollback

- **T01 is a breaking change** for consumers with short secrets: constructor now throws. Mitigation: clear error message with generation instructions; call it out in the changelog/version bump. Rollback: relax the check to a `console.warn` (one-line change).
- **Rate limiting false positives** behind shared NATs or proxies (many users, one IP). Mitigation: per-email limiting carries most of the protection; per-IP thresholds configurable; trusted-proxy header opt-in. Rollback: config option to disable the limiter entirely.
- **Logout form change** touches every rendered page via the layout; a missed call site would break sign-out. Mitigation: routing-integration tests cover all three backends' page renders. Rollback: revert T05 commit — it is isolated.
- **Timing-oracle fix adds one bcrypt compare to unknown-email attempts**, slightly raising CPU cost per bogus request. The T04 limiter bounds this; land T04 before or with T03 if load is a concern.
- **In-memory limiter state is lost on restart** — acceptable; documented. Nothing to roll back.

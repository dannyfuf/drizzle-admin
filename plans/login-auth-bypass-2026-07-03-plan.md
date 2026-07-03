# Login authentication bypass via CSRF-token replay — Plan
> Tracker: ./login-auth-bypass-2026-07-03-tracker.md
> KEEP THE TRACKER UPDATED. The plan is reference; the tracker is truth. Update it before you commit.

## Summary
The admin login can be bypassed entirely without credentials. CSRF tokens and session tokens are both plain HS256 JWTs signed with the same `sessionSecret`, and neither carries a claim that says what kind of token it is. The auth middleware's `verifyToken` accepts any validly-signed JWT. Because anyone can `GET /login` and receive a `_csrf` cookie — a JWT with `{ adminId: 0, email: 'csrf' }` — an attacker can copy that value into an `admin_session` cookie and be treated as an authenticated admin (id `0`). This plan reproduces the bypass, fixes the root cause by making the two token types cryptographically distinguishable and validating the expected type on every check, and adds regression tests. It also pins the JWT verification algorithm as defense-in-depth.

## Sizing call
**Standard.** The work is confined to one subsystem (`src/auth/*` plus the login route and its tests) and is a focused stretch well under a week. It is more than a trivial two-file edit because the fix changes a shared token contract (`createToken`/`verifyToken`) consumed by both the session flow and the CSRF flow, so several call sites and their tests move together. It does not span multiple subsystems, need intermediate shippable states, or carry sequencing risk, so it is not phased.

## Repository context
- **Project type:** TypeScript library (ESM, `"type": "module"`). Auth built on `hono`, `jose` (JWT), `bcryptjs`.
- **Test runner:** `pnpm test` → `vitest run`. Watch mode: `pnpm test:watch`.
- **Type-check:** `pnpm typecheck` → `tsc --noEmit`. Build: `pnpm build` → `tsc`.
- **Lint:** No ESLint/Biome config in `package.json`. A `deno.json` exists (Deno-style tooling), but the package toolchain the scripts drive is pnpm + vitest + tsc. Treat type-check + tests as the gate; do not introduce a new linter for this fix.
- **Auth layout:**
  - `src/auth/jwt.ts` — `createToken` / `verifyToken` (HS256, 24h). `verifyToken` does not restrict algorithms.
  - `src/auth/csrf.ts` — CSRF token is `createToken({ adminId: 0, email: 'csrf' }, secret)`; double-submit cookie (`_csrf`) validated in `validateCsrf`.
  - `src/auth/middleware.ts` — reads `admin_session` cookie, calls `verifyToken`, sets admin context. **This is where the forged CSRF token is accepted as a session.**
  - `src/routes/auth.ts` — `GET/POST /login`, `/logout`. Issues session token on valid credentials.
  - Tests: `src/auth/__tests__/{jwt,csrf,contract,password}.test.ts`; routing integration tests under `src/__tests__/`.

## Assumptions
- The single `sessionSecret` is intended to stay single; the fix distinguishes token *purpose*, not by using separate secrets. (Separate secrets are a valid alternative but a larger change; the claim-based approach is smaller and equally sound.)
- `jose` is configured for symmetric HS256 keys; algorithm pinning uses `algorithms: ['HS256']`.
- `adminId: 0` is not a legitimate admin id in practice, but the fix must not rely on that — the defense is the token-type claim, not the id value.

## Out of scope
- **Login user-enumeration via timing:** the POST handler returns immediately when no admin matches the email but runs bcrypt when one does, leaking which emails exist. Real but separate; capture as a follow-up.
- Rotating or lengthening the session secret, adding refresh tokens, rate-limiting login attempts, or account lockout.
- Broader CSRF strategy changes (e.g. switching away from double-submit).

## Affected areas
- `src/auth/jwt.ts` — add a token-type/audience claim to `createToken`; validate it and pin the algorithm in `verifyToken`.
- `src/auth/csrf.ts` — mint and validate CSRF tokens as the `csrf` type only.
- `src/auth/middleware.ts` — validate the `admin_session` token as the `session` type only.
- `src/routes/auth.ts` — ensure session issuance uses the session type (follows from the `jwt.ts` change).
- `src/auth/__tests__/jwt.test.ts`, `src/auth/__tests__/csrf.test.ts` — update for the new contract.
- New regression coverage for the middleware (`src/auth/__tests__/middleware.test.ts` or an integration test) proving a CSRF token is rejected as a session.

## Tasks

### T01 — Reproduce the bypass with a failing test
- **Intent:** Prove, in an automated test, that a `_csrf` token is currently accepted as a valid `admin_session`.
- **Touches:** `src/auth/__tests__/` (new middleware/integration test).
- **Steps:**
  - Write a test that stands up `authMiddleware(secret)` on a protected route.
  - Generate a token via the CSRF path (`generateCsrfToken(secret)` or `createToken({ adminId: 0, email: 'csrf' }, secret)`).
  - Send it as the `admin_session` cookie and assert the request reaches the protected handler (demonstrating the bypass).
  - Confirm this test **passes today** (documenting the vulnerability), and note it will be inverted in T04 to assert rejection.
- **Verification:** `pnpm test` — the new test runs and currently demonstrates the bypass (green against vulnerable code).
- **Done when:** A committed test reproduces the CSRF-as-session acceptance against the current code.

### T02 — Add a token-type claim and validate it in the JWT layer
- **Intent:** Make session and CSRF tokens cryptographically distinguishable so one cannot be replayed as the other.
- **Touches:** `src/auth/jwt.ts`.
- **Steps:**
  - Introduce a token-type discriminator (e.g. a `typ`/`aud` claim with values `session` and `csrf`) as a required parameter or two dedicated helpers.
  - Have `createToken` stamp the type into the payload.
  - Have `verifyToken` require an expected type and return `null` when the token's type does not match, in addition to signature/expiry checks.
  - Pin verification to `algorithms: ['HS256']` in `jwtVerify` options (defense-in-depth against algorithm confusion).
  - Keep the `AdminTokenPayload` shape (`adminId`, `email`) intact for session tokens.
- **Verification:** `pnpm typecheck`; `pnpm test` for `jwt.test.ts` (updated in T05).
- **Done when:** `verifyToken` rejects a token whose type does not match the expected type, and only accepts HS256.

### T03 — Route CSRF and session flows through their own token type
- **Intent:** Ensure each flow mints and validates only its own token type.
- **Touches:** `src/auth/csrf.ts`, `src/auth/middleware.ts`, `src/routes/auth.ts`.
- **Steps:**
  - `csrf.ts`: mint the CSRF token as type `csrf`; `validateCsrf` verifies it as `csrf` only.
  - `middleware.ts`: verify the `admin_session` cookie as type `session` only; on mismatch, clear the cookie and redirect to login exactly as the existing invalid-token path does.
  - `routes/auth.ts`: confirm session issuance on successful login produces a `session`-type token (should follow automatically from the `jwt.ts` change; verify the call site).
  - Do not change cookie names, paths, or flags.
- **Verification:** `pnpm typecheck`; `pnpm test`.
- **Done when:** A `csrf` token presented as `admin_session` is rejected by the middleware, and normal login still authenticates.

### T04 — Invert the reproduction test into a regression assertion
- **Intent:** Lock the fix in place.
- **Touches:** the test added in T01.
- **Steps:**
  - Change the assertion so a CSRF token presented as `admin_session` is **rejected** (redirect to `/login`, protected handler not reached).
  - Add the positive case: a legitimately issued session token is accepted.
  - Optionally add the symmetric case: a session token is rejected by `validateCsrf`.
- **Verification:** `pnpm test` — the regression test fails against the pre-fix code and passes against the fixed code.
- **Done when:** The bypass test now asserts rejection and passes only with the fix applied.

### T05 — Update existing auth tests to the new contract
- **Intent:** Keep the suite green and meaningful under the new token contract.
- **Touches:** `src/auth/__tests__/jwt.test.ts`, `src/auth/__tests__/csrf.test.ts`.
- **Steps:**
  - Update `jwt.test.ts` to create/verify tokens with an explicit type and assert cross-type verification returns `null`.
  - Update `csrf.test.ts` if the CSRF generation signature changed; keep the existing cookie-path assertion.
  - Verify no other suite (routing integration tests) depends on the old `createToken`/`verifyToken` signatures; adjust if needed.
- **Verification:** `pnpm test` (full suite); `pnpm typecheck`.
- **Done when:** The entire suite passes and the JWT tests explicitly cover type separation.

## Verification
Run from the repo root:
- `pnpm typecheck` — clean (`tsc --noEmit`).
- `pnpm test` — full vitest suite passes, including the new regression test.
- Manual/optional: build once with `pnpm build` to confirm the emitted types still compile.

## Definition of done
- All tasks (T01–T05) checked off in the tracker.
- Type-check clean (`pnpm typecheck`).
- Full test suite passing (`pnpm test`), including the regression test that a CSRF token is rejected as a session.
- No lint regression (no linter configured; not applicable — note it in the tracker).
- The tracker reflects reality: verification output pasted per task.
- Follow-up for login timing/user-enumeration captured in the tracker's Follow-ups.

## Risks and rollback
- **Contract change ripple:** `createToken`/`verifyToken` signatures change, so every call site must move together. Mitigation: T02 and T03 land in one change; `pnpm typecheck` surfaces missed call sites before tests run.
- **Existing valid sessions invalidated:** adding a required type claim means tokens issued before the fix (lacking the claim) will fail verification, logging users out. Acceptable and arguably desirable for a security fix; note it so it is not mistaken for a regression.
- **Rollback:** the change is isolated to `src/auth/*`, `src/routes/auth.ts`, and their tests. Revert the commit to restore prior behavior; no data migrations or persisted schema are involved.

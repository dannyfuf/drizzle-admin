# Stage 2: Authentication

**Part of:** [DrizzleAdmin Implementation Plan](./plan-drizzle-admin-2026-02-26.md)
**Depends on:** [Stage 1: Foundation](./plan-stage-1-foundation.md)

## Summary

Implement the authentication system: JWT-based sessions stored in HTTP-only cookies, bcrypt password hashing, login/logout routes, and authentication middleware. This stage makes the admin panel secure.

## Prerequisites

- Stage 1 completed
- `bcrypt` and `jose` packages installed
- Test database with admin_users table

## Scope

**IN scope:**
- JWT token creation and verification
- bcrypt password hashing and comparison
- Login/logout routes
- Auth middleware for protected routes
- CSRF protection
- `seed()` method for creating first admin

**OUT of scope:**
- Login page HTML (Stage 4)
- Token revocation / blacklist
- Configurable token expiry

---

## Task Breakdown

### 2.1 Password Hashing Module
**Complexity:** Low
**Files:** `src/auth/password.ts`

Simple wrapper around bcrypt for password operations.

```ts
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

**Acceptance criteria:**
- [ ] `hashPassword` returns a bcrypt hash
- [ ] `verifyPassword` returns true for correct password
- [ ] `verifyPassword` returns false for incorrect password
- [ ] Hashes are different for same password (salt working)

---

### 2.2 JWT Module
**Complexity:** Medium
**Files:** `src/auth/jwt.ts`

Create and verify JWT tokens using the `jose` library.

```ts
import { SignJWT, jwtVerify, JWTPayload } from 'jose'

const TOKEN_EXPIRY = '24h'
const ALGORITHM = 'HS256'

export interface AdminTokenPayload extends JWTPayload {
  adminId: number
  email: string
}

export async function createToken(
  payload: { adminId: number; email: string },
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secretKey)
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<AdminTokenPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, secretKey)
    return payload as AdminTokenPayload
  } catch {
    return null
  }
}
```

**Acceptance criteria:**
- [ ] `createToken` produces valid JWT string
- [ ] `verifyToken` decodes valid tokens
- [ ] `verifyToken` returns null for expired tokens
- [ ] `verifyToken` returns null for invalid signatures

---

### 2.3 CSRF Module
**Complexity:** Medium
**Files:** `src/auth/csrf.ts`

Generate and validate CSRF tokens for form submissions.

```ts
import { Context } from 'hono'
import { createToken, verifyToken } from './jwt'

const CSRF_COOKIE_NAME = '_csrf'
const CSRF_FIELD_NAME = '_csrf'

export async function generateCsrfToken(secret: string): Promise<string> {
  // Simple approach: short-lived JWT
  return createToken({ adminId: 0, email: 'csrf' }, secret)
}

export async function setCsrfCookie(
  c: Context,
  secret: string
): Promise<string> {
  const token = await generateCsrfToken(secret)
  c.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60, // 1 hour
  })
  return token
}

export async function validateCsrf(
  c: Context,
  secret: string
): Promise<boolean> {
  const cookieToken = c.cookie(CSRF_COOKIE_NAME)
  const formToken = await getFormCsrfToken(c)

  if (!cookieToken || !formToken) return false
  if (cookieToken !== formToken) return false

  const payload = await verifyToken(cookieToken, secret)
  return payload !== null
}

async function getFormCsrfToken(c: Context): Promise<string | null> {
  const body = await c.req.parseBody()
  return (body[CSRF_FIELD_NAME] as string) ?? null
}

// Helper for templates
export function csrfInput(token: string): string {
  return `<input type="hidden" name="${CSRF_FIELD_NAME}" value="${token}">`
}
```

**Acceptance criteria:**
- [ ] `setCsrfCookie` sets HTTP-only cookie
- [ ] `validateCsrf` passes when cookie matches form token
- [ ] `validateCsrf` fails when tokens don't match
- [ ] `csrfInput` produces valid hidden input HTML

---

### 2.4 Auth Middleware
**Complexity:** Medium
**Files:** `src/auth/middleware.ts`

Hono middleware that protects routes by verifying JWT cookie.

```ts
import { Context, Next } from 'hono'
import { verifyToken, AdminTokenPayload } from './jwt'

const AUTH_COOKIE_NAME = 'admin_session'
const LOGIN_PATH = '/login'

// Extend Hono context with admin user
declare module 'hono' {
  interface ContextVariableMap {
    admin: AdminTokenPayload
  }
}

export function authMiddleware(sessionSecret: string) {
  return async (c: Context, next: Next) => {
    const token = c.cookie(AUTH_COOKIE_NAME)

    if (!token) {
      return c.redirect(LOGIN_PATH)
    }

    const payload = await verifyToken(token, sessionSecret)

    if (!payload) {
      // Invalid or expired token - clear cookie and redirect
      c.cookie(AUTH_COOKIE_NAME, '', { maxAge: 0 })
      return c.redirect(LOGIN_PATH)
    }

    c.set('admin', payload)
    await next()
  }
}

export function setAuthCookie(
  c: Context,
  token: string
): void {
  c.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })
}

export function clearAuthCookie(c: Context): void {
  c.cookie(AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' })
}
```

**Acceptance criteria:**
- [ ] Middleware redirects to login when no cookie
- [ ] Middleware redirects when token invalid
- [ ] Middleware sets `c.get('admin')` when valid
- [ ] Cookie is HTTP-only and Strict same-site

---

### 2.5 Auth Routes
**Complexity:** High
**Files:** `src/routes/auth.ts`

Login and logout route handlers.

```ts
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { verifyPassword } from '../auth/password'
import { createToken } from '../auth/jwt'
import { setAuthCookie, clearAuthCookie } from '../auth/middleware'
import { setCsrfCookie, validateCsrf, csrfInput } from '../auth/csrf'

interface AuthRoutesConfig {
  db: any
  adminUsers: any
  sessionSecret: string
  renderLogin: (props: { error?: string; csrfToken: string }) => string
}

export function createAuthRoutes(config: AuthRoutesConfig): Hono {
  const app = new Hono()

  // GET /login
  app.get('/login', async (c) => {
    const csrfToken = await setCsrfCookie(c, config.sessionSecret)
    const html = config.renderLogin({ csrfToken })
    return c.html(html)
  })

  // POST /login
  app.post('/login', async (c) => {
    // Validate CSRF
    const csrfValid = await validateCsrf(c, config.sessionSecret)
    if (!csrfValid) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid request. Please try again.',
        csrfToken,
      }))
    }

    const body = await c.req.parseBody()
    const email = body.email as string
    const password = body.password as string

    if (!email || !password) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Email and password are required.',
        csrfToken,
      }))
    }

    // Find admin user
    const [admin] = await config.db
      .select()
      .from(config.adminUsers)
      .where(eq(config.adminUsers.email, email))
      .limit(1)

    if (!admin) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
      }))
    }

    // Verify password
    const valid = await verifyPassword(password, admin.passwordHash)
    if (!valid) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
      }))
    }

    // Create session
    const token = await createToken(
      { adminId: admin.id, email: admin.email },
      config.sessionSecret
    )
    setAuthCookie(c, token)

    return c.redirect('/')
  })

  // GET/POST /logout
  app.all('/logout', (c) => {
    clearAuthCookie(c)
    return c.redirect('/login')
  })

  return app
}
```

**Acceptance criteria:**
- [ ] GET `/login` renders login form with CSRF token
- [ ] POST `/login` validates CSRF token
- [ ] POST `/login` checks email/password against database
- [ ] Successful login sets cookie and redirects to `/`
- [ ] Failed login re-renders form with error
- [ ] `/logout` clears cookie and redirects to `/login`

---

### 2.6 Seed Method
**Complexity:** Low
**Files:** `src/DrizzleAdmin.ts` (update)

Implement the `seed()` method for creating the first admin user.

```ts
// In DrizzleAdmin class

async seed(params: { email: string; password: string }): Promise<void> {
  const { email, password } = params

  // Check if admin already exists
  const [existing] = await this.config.db
    .select()
    .from(this.config.adminUsers)
    .where(eq(this.config.adminUsers.email, email))
    .limit(1)

  if (existing) {
    console.log(`Admin user "${email}" already exists, skipping seed.`)
    return
  }

  // Hash password and insert
  const passwordHash = await hashPassword(password)

  await this.config.db.insert(this.config.adminUsers).values({
    email,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  console.log(`Created admin user: ${email}`)
}
```

**Acceptance criteria:**
- [ ] Creates admin user with hashed password
- [ ] Skips if email already exists (no error)
- [ ] Logs appropriate message

---

## Testing Strategy

### Unit Tests to Write

| Test File | Coverage |
|-----------|----------|
| `src/auth/password.test.ts` | Hash/verify operations |
| `src/auth/jwt.test.ts` | Token create/verify, expiry |
| `src/auth/csrf.test.ts` | Token generation, validation |
| `src/auth/middleware.test.ts` | Auth flow (mock Hono context) |

### Integration Tests

| Test File | Coverage |
|-----------|----------|
| `src/routes/auth.test.ts` | Full login/logout flow with test DB |

### Manual Verification

1. Start server with test database
2. Navigate to `/login` - should see form
3. Enter wrong credentials - should see error
4. Enter correct credentials - should redirect to `/`
5. Verify cookie is set (inspect browser dev tools)
6. Navigate to `/logout` - should clear cookie and redirect
7. Try accessing protected route - should redirect to login

---

## Definition of Done

- [ ] All 6 subtasks completed
- [ ] `pnpm test` passes all unit/integration tests
- [ ] `pnpm tsc --noEmit` succeeds
- [ ] Login flow works end-to-end manually
- [ ] Cookies are properly secured (HTTP-only, SameSite)

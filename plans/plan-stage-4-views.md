# Stage 4: View Layer

**Part of:** [DrizzleAdmin Implementation Plan](./plan-drizzle-admin-2026-02-26.md)
**Depends on:** [Stage 2: Authentication](./plan-stage-2-authentication.md), [Stage 3: Resource System](./plan-stage-3-resources.md)

## Summary

Build the server-rendered view layer using template literal functions. This includes the main layout with sidebar navigation, login page, flash message system, and shared component utilities. All styling uses Tailwind CSS via CDN with a dark-mode-first shadcn-inspired aesthetic.

## Prerequisites

- Stages 2 and 3 completed
- Resources loaded and accessible
- Understanding of template literal functions for HTML

## Scope

**IN scope:**
- Main layout (header, sidebar, content area, footer)
- Login page
- Flash message cookie system
- Shared style utilities
- Component templates (buttons, cards, inputs)
- Tailwind CDN integration

**OUT of scope:**
- Index/show/form views (Stage 5)
- Modal component (Stage 6)
- Pagination component (Stage 5)

---

## Task Breakdown

### 4.1 Tailwind & Base Styles
**Complexity:** Low
**Files:** `src/views/styles.ts`

Shared Tailwind class utilities for consistent styling.

```ts
// Design tokens based on shadcn dark mode aesthetic
export const styles = {
  // Layout
  bg: 'bg-zinc-950',
  bgCard: 'bg-zinc-900',
  bgHover: 'hover:bg-zinc-800',
  border: 'border border-zinc-800',

  // Typography
  text: 'text-zinc-100',
  textMuted: 'text-zinc-400',
  textError: 'text-red-400',
  textSuccess: 'text-emerald-400',

  // Buttons
  btnPrimary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-medium px-4 py-2 rounded-lg transition-colors',
  btnSecondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 font-medium px-4 py-2 rounded-lg border border-zinc-700 transition-colors',
  btnDanger: 'bg-red-600 text-white hover:bg-red-700 font-medium px-4 py-2 rounded-lg transition-colors',
  btnGhost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 px-4 py-2 rounded-lg transition-colors',

  // Forms
  input: 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent',
  label: 'block text-sm font-medium text-zinc-300 mb-1',
  checkbox: 'w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-zinc-600',

  // Cards/Containers
  card: 'bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm',
  cardPadded: 'bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm p-6',

  // Table
  table: 'w-full',
  tableHeader: 'text-left text-sm font-medium text-zinc-400 uppercase tracking-wider',
  tableRow: 'border-b border-zinc-800 hover:bg-zinc-800/50',
  tableCell: 'px-4 py-3 text-sm text-zinc-300',

  // Links
  link: 'text-zinc-100 hover:text-white underline underline-offset-4',
  navLink: 'flex items-center gap-2 px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors',
  navLinkActive: 'flex items-center gap-2 px-3 py-2 text-zinc-100 bg-zinc-800 rounded-lg',
}

// Tailwind CDN script tag
export const tailwindScript = `
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          zinc: {
            950: '#09090b',
          }
        }
      }
    }
  }
</script>
`
```

**Acceptance criteria:**
- [ ] All style tokens defined
- [ ] Consistent naming convention
- [ ] Tailwind CDN config included

---

### 4.2 Flash Message System
**Complexity:** Medium
**Files:** `src/utils/flash.ts`

Cookie-based flash messages for action feedback.

```ts
import type { Context } from 'hono'

const FLASH_COOKIE = '_flash'

export type FlashType = 'success' | 'error' | 'info'

export interface FlashMessage {
  type: FlashType
  message: string
}

// Set a flash message (called after actions)
export function setFlash(c: Context, type: FlashType, message: string): void {
  const value = JSON.stringify({ type, message })
  c.cookie(FLASH_COOKIE, value, {
    httpOnly: true,
    maxAge: 60,  // 1 minute - enough for redirect
    path: '/',
  })
}

// Get and clear flash message (called when rendering)
export function getFlash(c: Context): FlashMessage | null {
  const value = c.cookie(FLASH_COOKIE)
  if (!value) return null

  // Clear the cookie
  c.cookie(FLASH_COOKIE, '', { maxAge: 0, path: '/' })

  try {
    return JSON.parse(value) as FlashMessage
  } catch {
    return null
  }
}
```

**Acceptance criteria:**
- [ ] `setFlash` stores message in cookie
- [ ] `getFlash` retrieves and clears cookie
- [ ] Invalid JSON handled gracefully

---

### 4.3 Flash Component
**Complexity:** Low
**Files:** `src/views/components/flash.ts`

Render flash messages as dismissible banners.

```ts
import { FlashMessage } from '../../utils/flash'
import { styles } from '../styles'

export function renderFlash(flash: FlashMessage | null): string {
  if (!flash) return ''

  const colorClasses = {
    success: 'bg-emerald-900/50 border-emerald-700 text-emerald-200',
    error: 'bg-red-900/50 border-red-700 text-red-200',
    info: 'bg-blue-900/50 border-blue-700 text-blue-200',
  }

  return `
    <div class="mb-6 p-4 rounded-lg border ${colorClasses[flash.type]}" role="alert">
      <div class="flex items-center justify-between">
        <span>${escapeHtml(flash.message)}</span>
        <button
          type="button"
          onclick="this.parentElement.parentElement.remove()"
          class="text-current opacity-70 hover:opacity-100"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `
}

// Basic HTML escaping
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export { escapeHtml }
```

**Acceptance criteria:**
- [ ] Renders success/error/info with appropriate colors
- [ ] Dismissible via X button
- [ ] HTML escaped to prevent XSS
- [ ] Returns empty string when no flash

---

### 4.4 Main Layout
**Complexity:** High
**Files:** `src/views/layout.ts`

The main admin layout with header, sidebar, and content area.

```ts
import type { ResourceDefinition } from '../resources/types'
import type { AdminTokenPayload } from '../auth/jwt'
import type { FlashMessage } from '../utils/flash'
import { styles, tailwindScript } from './styles'
import { renderFlash } from './components/flash'

export interface LayoutProps {
  title: string
  content: string
  admin: AdminTokenPayload
  resources: ResourceDefinition[]
  currentPath: string
  flash?: FlashMessage | null
  actionBar?: string  // Optional action bar HTML above content
}

export function layout(props: LayoutProps): string {
  const { title, content, admin, resources, currentPath, flash, actionBar } = props

  return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | DrizzleAdmin</title>
  ${tailwindScript}
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="${styles.bg} ${styles.text} min-h-screen">
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-64 ${styles.bgCard} ${styles.border} border-t-0 border-l-0 border-b-0 flex flex-col">
      <!-- Logo -->
      <div class="p-4 border-b border-zinc-800">
        <a href="/" class="text-xl font-bold text-zinc-100">DrizzleAdmin</a>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-4 space-y-1">
        ${resources.map(r => renderNavItem(r, currentPath)).join('')}
      </nav>

      <!-- User -->
      <div class="p-4 border-t border-zinc-800">
        <div class="${styles.textMuted} text-sm truncate">${escapeHtml(admin.email)}</div>
        <a href="/logout" class="${styles.textMuted} text-sm hover:text-zinc-100">Sign out</a>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 flex flex-col">
      <!-- Header -->
      <header class="h-14 ${styles.bgCard} ${styles.border} border-t-0 border-r-0 flex items-center px-6">
        <h1 class="text-lg font-semibold">${escapeHtml(title)}</h1>
      </header>

      <!-- Content area -->
      <div class="flex-1 p-6">
        ${renderFlash(flash ?? null)}
        ${actionBar ? `<div class="mb-6">${actionBar}</div>` : ''}
        ${content}
      </div>

      <!-- Footer -->
      <footer class="h-12 ${styles.bgCard} ${styles.border} border-b-0 border-r-0 flex items-center justify-center">
        <span class="${styles.textMuted} text-sm">DrizzleAdmin</span>
      </footer>
    </main>
  </div>
</body>
</html>
`
}

function renderNavItem(resource: ResourceDefinition, currentPath: string): string {
  const href = `/${resource.routePath}`
  const isActive = currentPath.startsWith(href)
  const className = isActive ? styles.navLinkActive : styles.navLink

  return `
    <a href="${href}" class="${className}">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
      </svg>
      ${escapeHtml(resource.displayName)}s
    </a>
  `
}

import { escapeHtml } from './components/flash'
```

**Acceptance criteria:**
- [ ] Renders full HTML document with Tailwind
- [ ] Sidebar shows all resources
- [ ] Current resource is highlighted
- [ ] Admin email shown with logout link
- [ ] Flash messages render above content
- [ ] Action bar renders when provided

---

### 4.5 Login Page
**Complexity:** Medium
**Files:** `src/views/login.ts`

Standalone login page (no layout/sidebar).

```ts
import { styles, tailwindScript } from './styles'
import { escapeHtml } from './components/flash'
import { csrfInput } from '../auth/csrf'

export interface LoginProps {
  csrfToken: string
  error?: string
}

export function loginPage(props: LoginProps): string {
  const { csrfToken, error } = props

  return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In | DrizzleAdmin</title>
  ${tailwindScript}
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="${styles.bg} ${styles.text} min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <!-- Logo -->
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold">DrizzleAdmin</h1>
      <p class="${styles.textMuted}">Sign in to continue</p>
    </div>

    <!-- Card -->
    <div class="${styles.cardPadded}">
      ${error ? `
        <div class="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 text-sm">
          ${escapeHtml(error)}
        </div>
      ` : ''}

      <form method="POST" action="/login" class="space-y-4">
        ${csrfInput(csrfToken)}

        <div>
          <label for="email" class="${styles.label}">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autocomplete="email"
            class="${styles.input}"
            placeholder="admin@example.com"
          >
        </div>

        <div>
          <label for="password" class="${styles.label}">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autocomplete="current-password"
            class="${styles.input}"
          >
        </div>

        <button type="submit" class="${styles.btnPrimary} w-full">
          Sign in
        </button>
      </form>
    </div>
  </div>
</body>
</html>
`
}
```

**Acceptance criteria:**
- [ ] Centered card layout
- [ ] Email and password fields
- [ ] CSRF token included
- [ ] Error message shown when provided
- [ ] Proper autocomplete attributes

---

### 4.6 Field Renderer Component
**Complexity:** High
**Files:** `src/views/components/field.ts`

Render form inputs based on column metadata.

```ts
import type { ColumnMeta } from '../../dialects/types'
import { styles } from '../styles'
import { escapeHtml } from './flash'

export interface FieldProps {
  column: ColumnMeta
  value?: unknown
  error?: string
}

export function renderField(props: FieldProps): string {
  const { column, value, error } = props

  // Skip auto-managed fields
  if (isAutoManaged(column)) {
    return ''
  }

  const inputHtml = renderInput(column, value)

  return `
    <div class="space-y-1">
      <label for="${column.name}" class="${styles.label}">
        ${formatLabel(column.name)}
        ${column.isNullable ? '' : '<span class="text-red-400">*</span>'}
      </label>
      ${inputHtml}
      ${error ? `<p class="text-sm ${styles.textError}">${escapeHtml(error)}</p>` : ''}
    </div>
  `
}

function renderInput(column: ColumnMeta, value: unknown): string {
  const name = column.name
  const required = !column.isNullable && !column.hasDefault

  // Password fields
  if (isPasswordColumn(column)) {
    return `
      <input
        type="password"
        id="${name}"
        name="${name}"
        class="${styles.input}"
        ${required ? 'required' : ''}
      >
    `
  }

  // Enum - select dropdown
  if (column.dataType === 'enum' && column.enumValues) {
    const options = column.enumValues
      .map(v => `<option value="${v}" ${value === v ? 'selected' : ''}>${v}</option>`)
      .join('')

    return `
      <select id="${name}" name="${name}" class="${styles.input}" ${required ? 'required' : ''}>
        <option value="">Select...</option>
        ${options}
      </select>
    `
  }

  // Boolean - checkbox
  if (column.dataType === 'boolean') {
    return `
      <input
        type="checkbox"
        id="${name}"
        name="${name}"
        value="true"
        class="${styles.checkbox}"
        ${value === true ? 'checked' : ''}
      >
    `
  }

  // JSON - textarea
  if (column.dataType === 'json') {
    const formatted = value ? JSON.stringify(value, null, 2) : ''
    return `
      <textarea
        id="${name}"
        name="${name}"
        rows="4"
        class="${styles.input} font-mono text-sm"
        ${required ? 'required' : ''}
      >${escapeHtml(formatted)}</textarea>
    `
  }

  // Timestamp - datetime-local
  if (column.dataType === 'timestamp') {
    const formatted = value instanceof Date
      ? value.toISOString().slice(0, 16)
      : (typeof value === 'string' ? value.slice(0, 16) : '')

    return `
      <input
        type="datetime-local"
        id="${name}"
        name="${name}"
        value="${formatted}"
        class="${styles.input}"
        ${required ? 'required' : ''}
      >
    `
  }

  // Integer - number input
  if (column.dataType === 'integer') {
    return `
      <input
        type="number"
        id="${name}"
        name="${name}"
        value="${value ?? ''}"
        class="${styles.input}"
        ${required ? 'required' : ''}
      >
    `
  }

  // Default - text input
  return `
    <input
      type="text"
      id="${name}"
      name="${name}"
      value="${escapeHtml(String(value ?? ''))}"
      class="${styles.input}"
      ${required ? 'required' : ''}
    >
  `
}

// Auto-managed columns should not appear in forms
function isAutoManaged(column: ColumnMeta): boolean {
  if (column.isPrimaryKey) return true
  if (['createdAt', 'created_at', 'updatedAt', 'updated_at'].includes(column.name)) {
    return column.hasDefault
  }
  return false
}

// Detect password columns
function isPasswordColumn(column: ColumnMeta): boolean {
  const name = column.name.toLowerCase()
  return name.includes('password')
}

// Convert camelCase/snake_case to Label
function formatLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')  // camelCase
    .replace(/_/g, ' ')          // snake_case
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}
```

**Acceptance criteria:**
- [ ] Renders appropriate input type per column
- [ ] Handles required vs optional correctly
- [ ] Password fields use type="password"
- [ ] Enum fields use select with options
- [ ] JSON fields use textarea with formatting
- [ ] Auto-managed fields are skipped

---

### 4.7 Button Components
**Complexity:** Low
**Files:** `src/views/components/button.ts`

Reusable button and link components.

```ts
import { styles } from '../styles'
import { escapeHtml } from './flash'

export interface ButtonProps {
  label: string
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function button(props: ButtonProps): string {
  const { label, type = 'button', variant = 'primary', size = 'md', disabled = false } = props

  const variantClass = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    danger: styles.btnDanger,
    ghost: styles.btnGhost,
  }[variant]

  const sizeClass = size === 'sm' ? 'text-sm px-3 py-1.5' : ''

  return `
    <button
      type="${type}"
      class="${variantClass} ${sizeClass}"
      ${disabled ? 'disabled' : ''}
    >
      ${escapeHtml(label)}
    </button>
  `
}

export interface LinkButtonProps {
  label: string
  href: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export function linkButton(props: LinkButtonProps): string {
  const { label, href, variant = 'secondary', size = 'md' } = props

  const variantClass = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    danger: styles.btnDanger,
    ghost: styles.btnGhost,
  }[variant]

  const sizeClass = size === 'sm' ? 'text-sm px-3 py-1.5' : ''

  return `
    <a href="${href}" class="${variantClass} ${sizeClass} inline-block text-center no-underline">
      ${escapeHtml(label)}
    </a>
  `
}
```

**Acceptance criteria:**
- [ ] Button renders with correct type
- [ ] All variants styled correctly
- [ ] LinkButton is an anchor styled as button
- [ ] Size variants work

---

## Testing Strategy

### Unit Tests to Write

| Test File | Coverage |
|-----------|----------|
| `src/utils/flash.test.ts` | Set/get flash messages |
| `src/views/components/flash.test.ts` | HTML rendering, escaping |
| `src/views/components/field.test.ts` | All field types, edge cases |
| `src/views/layout.test.ts` | Layout structure, navigation |
| `src/views/login.test.ts` | Login page HTML |

### Visual Verification

1. Render layout HTML to file
2. Open in browser
3. Verify Tailwind loads via CDN
4. Check dark mode styling
5. Verify responsive behavior
6. Test all button/input variants

### Manual Verification

1. Start DrizzleAdmin with test resources
2. Navigate to login - verify styling
3. Login and verify layout with sidebar
4. Verify flash messages appear and dismiss

---

## Definition of Done

- [ ] All 7 subtasks completed
- [ ] `pnpm test` passes all unit tests
- [ ] `pnpm tsc --noEmit` succeeds
- [ ] Views render valid HTML
- [ ] Tailwind CDN loads correctly in browser
- [ ] Dark mode styling matches shadcn aesthetic

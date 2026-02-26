import type { ResourceDefinition } from '../resources/types.js'
import type { AdminTokenPayload } from '../auth/jwt.js'
import type { FlashMessage } from '../utils/flash.js'
import { styles, tailwindScript } from './styles.js'
import { renderFlash, escapeHtml } from './components/flash.js'
import { modalScript } from './components/modal.js'

export interface LayoutProps {
  title: string
  content: string
  admin: AdminTokenPayload
  resources: ResourceDefinition[]
  currentPath: string
  flash?: FlashMessage | null
  modals?: string
}

export function layout(props: LayoutProps): string {
  const { title, content, admin, resources, currentPath, flash, modals } = props

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
      <div class="p-4 border-b border-zinc-800">
        <a href="/" class="text-xl font-bold text-zinc-100">DrizzleAdmin</a>
      </div>
      <nav class="flex-1 p-4 space-y-1">
        ${resources.map(r => renderNavItem(r, currentPath)).join('')}
      </nav>
      <div class="p-4 border-t border-zinc-800">
        <div class="${styles.textMuted} text-sm truncate">${escapeHtml(admin.email)}</div>
        <a href="/logout" class="${styles.textMuted} text-sm hover:text-zinc-100">Sign out</a>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 flex flex-col">
      <header class="h-14 ${styles.bgCard} ${styles.border} border-t-0 border-r-0 flex items-center px-6">
        <h1 class="text-lg font-semibold">${escapeHtml(title)}</h1>
      </header>
      <div class="flex-1 p-6">
        ${renderFlash(flash ?? null)}
        ${content}
      </div>
      <footer class="h-12 ${styles.bgCard} ${styles.border} border-b-0 border-r-0 flex items-center justify-center">
        <span class="${styles.textMuted} text-sm">DrizzleAdmin</span>
      </footer>
    </main>
  </div>

  ${modals ?? ''}
  ${modalScript}
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

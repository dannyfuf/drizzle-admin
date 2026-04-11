import type { ResourceDefinition } from '@/resources/types.ts'
import type { AdminTokenPayload } from '@/auth/jwt.ts'
import type { FlashMessage } from '@/utils/flash.ts'
import { styles, tailwindScript } from '@/views/styles.ts'
import { renderFlash, escapeHtml } from '@/views/components/flash.ts'
import { modalScript } from '@/views/components/modal.ts'
import { adminUrl } from '@/utils/url.ts'

export interface LayoutProps {
  title: string
  content: string
  admin: AdminTokenPayload
  resources: ResourceDefinition[]
  currentPath: string
  basePath: string
  flash?: FlashMessage | null
  modals?: string
}

export function layout(props: LayoutProps): string {
  const { title, content, admin, resources, currentPath, basePath, flash, modals } = props

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
    details[open] > summary svg { transform: rotate(90deg) !important; }
    details > summary::-webkit-details-marker { display: none; }
  </style>
</head>
<body class="${styles.bg} ${styles.text} min-h-screen">
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-64 ${styles.bgCard} ${styles.border} border-t-0 border-l-0 border-b-0 flex flex-col">
      <div class="p-4 border-b border-zinc-800">
        <a href="${adminUrl(basePath, '/')}" class="text-xl font-bold text-zinc-100">DrizzleAdmin</a>
      </div>
      <nav class="flex-1 p-4 space-y-1">
        ${renderSidebar(resources, currentPath, basePath)}
      </nav>
      <div class="p-4 border-t border-zinc-800">
        <div class="${styles.textMuted} text-sm truncate">${escapeHtml(admin.email)}</div>
        <a href="${adminUrl(basePath, '/logout')}" class="${styles.textMuted} text-sm hover:text-zinc-100">Sign out</a>
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

function renderNavItem(resource: ResourceDefinition, currentPath: string, basePath: string): string {
  const href = adminUrl(basePath, `/${resource.routePath}`)
  const isActive = currentPath.startsWith(`/${resource.routePath}`)
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

export interface SidebarGroup {
  folder: string | null
  resources: ResourceDefinition[]
}

/**
 * Groups resources for sidebar rendering.
 * - Ungrouped resources (no folder) come first, sorted by displayName.
 * - Folder groups follow, sorted by folder name.
 * - Resources within each folder are sorted by displayName.
 */
export function groupResourcesForSidebar(resources: ResourceDefinition[]): SidebarGroup[] {
  const ungrouped: ResourceDefinition[] = []
  const folderMap = new Map<string, ResourceDefinition[]>()

  for (const r of resources) {
    if (r.folder) {
      const list = folderMap.get(r.folder) ?? []
      list.push(r)
      folderMap.set(r.folder, list)
    } else {
      ungrouped.push(r)
    }
  }

  ungrouped.sort((a, b) => a.displayName.localeCompare(b.displayName))

  const groups: SidebarGroup[] = []

  if (ungrouped.length > 0) {
    groups.push({ folder: null, resources: ungrouped })
  }

  const sortedFolders = [...folderMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  for (const [folder, items] of sortedFolders) {
    items.sort((a, b) => a.displayName.localeCompare(b.displayName))
    groups.push({ folder, resources: items })
  }

  return groups
}

function renderFolder(
  group: SidebarGroup,
  currentPath: string,
  basePath: string,
): string {
  const hasActive = group.resources.some(r =>
    currentPath.startsWith(`/${r.routePath}`)
  )
  const openAttr = hasActive ? ' open' : ''

  return `
    <details class="${styles.folderDetails}"${openAttr}>
      <summary class="${styles.folderSummary}">
        <svg class="w-3 h-3 transition-transform" style="transform: rotate(0deg)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
        ${escapeHtml(group.folder!)}
      </summary>
      <div class="ml-2 space-y-1">
        ${group.resources.map(r => renderNavItem(r, currentPath, basePath)).join('')}
      </div>
    </details>
  `
}

function renderSidebar(
  resources: ResourceDefinition[],
  currentPath: string,
  basePath: string,
): string {
  const groups = groupResourcesForSidebar(resources)

  return groups.map(group => {
    if (group.folder === null) {
      return group.resources
        .map(r => renderNavItem(r, currentPath, basePath))
        .join('')
    }
    return renderFolder(group, currentPath, basePath)
  }).join('')
}

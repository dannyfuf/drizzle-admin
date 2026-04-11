import { describe, it, expect } from 'vitest'
import { layout, groupResourcesForSidebar } from '@/views/layout.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import type { PgTable } from 'drizzle-orm/pg-core'

function makeResource(overrides: Partial<ResourceDefinition> = {}): ResourceDefinition {
  return {
    table: {} as PgTable,
    tableName: 'cards',
    routePath: 'cards',
    displayName: 'Card',
    options: {},
    ...overrides,
  }
}

const baseProps = {
  title: 'Test Page',
  content: '<p>Hello World</p>',
  admin: { adminId: 1, email: 'admin@example.com' },
  resources: [makeResource()],
  currentPath: '/cards',
  basePath: '',
}

describe('layout', () => {
  it('returns full HTML document with DOCTYPE', () => {
    const html = layout(baseProps)
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('includes escaped title', () => {
    const html = layout(baseProps)
    expect(html).toContain('Test Page | DrizzleAdmin')
  })

  it('includes Tailwind script', () => {
    const html = layout(baseProps)
    expect(html).toContain('tailwindcss')
  })

  it('renders sidebar with resource nav items', () => {
    const html = layout(baseProps)
    expect(html).toContain('/cards')
    expect(html).toContain('Cards')
  })

  it('highlights active nav item', () => {
    const html = layout(baseProps)
    // active link uses navLinkActive style (bg-zinc-800)
    expect(html).toContain('bg-zinc-800')
  })

  it('renders admin email in sidebar', () => {
    const html = layout(baseProps)
    expect(html).toContain('admin@example.com')
  })

  it('includes sign out link', () => {
    const html = layout(baseProps)
    expect(html).toContain('Sign out')
    expect(html).toContain('/logout')
  })

  it('renders flash message when provided', () => {
    const html = layout({
      ...baseProps,
      flash: { type: 'success', message: 'Record created' },
    })
    expect(html).toContain('Record created')
  })

  it('does not render flash when null', () => {
    const html = layout({ ...baseProps, flash: null })
    // renderFlash(null) returns empty string, so no flash div
    expect(html).not.toContain('bg-emerald-900')
    expect(html).not.toContain('bg-red-900')
  })

  it('includes content in main area', () => {
    const html = layout(baseProps)
    expect(html).toContain('<p>Hello World</p>')
  })

  it('includes modals at end of body', () => {
    const html = layout({ ...baseProps, modals: '<div id="test-modal">Modal</div>' })
    expect(html).toContain('<div id="test-modal">Modal</div>')
  })
})

describe('groupResourcesForSidebar', () => {
  it('places ungrouped resources first, sorted by displayName', () => {
    const resources = [
      makeResource({ displayName: 'Zebra', routePath: 'zebras' }),
      makeResource({ displayName: 'Apple', routePath: 'apples' }),
    ]
    const groups = groupResourcesForSidebar(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.folder).toBeNull()
    expect(groups[0]!.resources.map(r => r.displayName)).toEqual(['Apple', 'Zebra'])
  })

  it('groups foldered resources under their folder name', () => {
    const resources = [
      makeResource({ displayName: 'Contact', routePath: 'contacts', folder: 'CRM' }),
      makeResource({ displayName: 'Deal', routePath: 'deals', folder: 'CRM' }),
    ]
    const groups = groupResourcesForSidebar(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.folder).toBe('CRM')
    expect(groups[0]!.resources).toHaveLength(2)
  })

  it('sorts folders alphabetically', () => {
    const resources = [
      makeResource({ displayName: 'Deal', routePath: 'deals', folder: 'Sales' }),
      makeResource({ displayName: 'Contact', routePath: 'contacts', folder: 'CRM' }),
    ]
    const groups = groupResourcesForSidebar(resources)
    expect(groups.map(g => g.folder)).toEqual(['CRM', 'Sales'])
  })

  it('sorts resources within each folder by displayName', () => {
    const resources = [
      makeResource({ displayName: 'Zebra', routePath: 'zebras', folder: 'Animals' }),
      makeResource({ displayName: 'Aardvark', routePath: 'aardvarks', folder: 'Animals' }),
    ]
    const groups = groupResourcesForSidebar(resources)
    expect(groups[0]!.resources.map(r => r.displayName)).toEqual(['Aardvark', 'Zebra'])
  })

  it('puts ungrouped resources before folders', () => {
    const resources = [
      makeResource({ displayName: 'Contact', routePath: 'contacts', folder: 'CRM' }),
      makeResource({ displayName: 'Card', routePath: 'cards' }),
    ]
    const groups = groupResourcesForSidebar(resources)
    expect(groups[0]!.folder).toBeNull()
    expect(groups[1]!.folder).toBe('CRM')
  })

  it('treats empty string folder as ungrouped', () => {
    const resources = [
      makeResource({ displayName: 'Card', routePath: 'cards', folder: '' }),
    ]
    const groups = groupResourcesForSidebar(resources)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.folder).toBeNull()
  })

  it('returns empty array for no resources', () => {
    expect(groupResourcesForSidebar([])).toEqual([])
  })
})

describe('layout sidebar folders', () => {
  it('renders ungrouped resources as flat nav links', () => {
    const html = layout({
      ...baseProps,
      resources: [
        makeResource({ displayName: 'Card', routePath: 'cards' }),
        makeResource({ displayName: 'Post', routePath: 'posts' }),
      ],
    })
    expect(html).not.toContain('<details')
    expect(html).toContain('Cards')
    expect(html).toContain('Posts')
  })

  it('renders foldered resources inside collapsible details', () => {
    const html = layout({
      ...baseProps,
      currentPath: '/other',
      resources: [
        makeResource({ displayName: 'Contact', routePath: 'contacts', folder: 'CRM' }),
        makeResource({ displayName: 'Deal', routePath: 'deals', folder: 'CRM' }),
      ],
    })
    expect(html).toContain('<details')
    expect(html).toContain('<summary')
    expect(html).toContain('CRM')
  })

  it('auto-opens folder when it contains active resource', () => {
    const html = layout({
      ...baseProps,
      currentPath: '/contacts',
      resources: [
        makeResource({ displayName: 'Contact', routePath: 'contacts', folder: 'CRM' }),
      ],
    })
    expect(html).toContain('<details class="space-y-1" open>')
  })

  it('does not auto-open folder when no active resource', () => {
    const html = layout({
      ...baseProps,
      currentPath: '/other',
      resources: [
        makeResource({ displayName: 'Contact', routePath: 'contacts', folder: 'CRM' }),
      ],
    })
    // The <details> should NOT have the open attribute when no resource is active
    expect(html).toContain('<details class="space-y-1">')
    expect(html).not.toContain('<details class="space-y-1" open>')
  })

  it('sorts resources within a folder by displayName', () => {
    const html = layout({
      ...baseProps,
      currentPath: '/other',
      resources: [
        makeResource({ displayName: 'Zebra', routePath: 'zebras', folder: 'Animals' }),
        makeResource({ displayName: 'Aardvark', routePath: 'aardvarks', folder: 'Animals' }),
      ],
    })
    const aardvarkPos = html.indexOf('Aardvark')
    const zebraPos = html.indexOf('Zebra')
    expect(aardvarkPos).toBeLessThan(zebraPos)
  })

  it('renders ungrouped items before folders', () => {
    const html = layout({
      ...baseProps,
      currentPath: '/other',
      resources: [
        makeResource({ displayName: 'Contact', routePath: 'contacts', folder: 'CRM' }),
        makeResource({ displayName: 'Card', routePath: 'cards' }),
      ],
    })
    const cardPos = html.indexOf('Cards')
    const crmPos = html.indexOf('CRM')
    expect(cardPos).toBeLessThan(crmPos)
  })
})

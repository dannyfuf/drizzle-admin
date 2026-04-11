import { describe, it, expect } from 'vitest'
import { layout } from '@/views/layout.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

function makeResource(overrides: Partial<ResourceDefinition> = {}): ResourceDefinition {
  return {
    table: {},
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

import { describe, it, expect } from 'vitest'
import { button, linkButton } from '@/views/components/button.ts'

describe('button', () => {
  it('renders button element with default type "button"', () => {
    const html = button({ label: 'Click' })
    expect(html).toContain('<button')
    expect(html).toContain('type="button"')
  })

  it('applies primary variant class', () => {
    const html = button({ label: 'Click', variant: 'primary' })
    expect(html).toContain('bg-zinc-100')
  })

  it('applies secondary variant class', () => {
    const html = button({ label: 'Click', variant: 'secondary' })
    expect(html).toContain('bg-zinc-800')
  })

  it('applies danger variant class', () => {
    const html = button({ label: 'Click', variant: 'danger' })
    expect(html).toContain('bg-red-600')
  })

  it('applies ghost variant class', () => {
    const html = button({ label: 'Click', variant: 'ghost' })
    expect(html).toContain('hover:text-zinc-100')
  })

  it('uses submit type when specified', () => {
    const html = button({ label: 'Save', type: 'submit' })
    expect(html).toContain('type="submit"')
  })

  it('applies small size class', () => {
    const html = button({ label: 'Click', size: 'sm' })
    expect(html).toContain('text-sm')
    expect(html).toContain('px-3')
  })

  it('adds disabled attribute', () => {
    const html = button({ label: 'Click', disabled: true })
    expect(html).toContain('disabled')
  })

  it('escapes HTML in label', () => {
    const html = button({ label: '<b>Bold</b>' })
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('<b>Bold</b>')
  })
})

describe('linkButton', () => {
  it('renders anchor element with href', () => {
    const html = linkButton({ label: 'Go', href: '/path' })
    expect(html).toContain('<a')
    expect(html).toContain('href="/path"')
  })

  it('applies default secondary variant', () => {
    const html = linkButton({ label: 'Go', href: '/path' })
    expect(html).toContain('bg-zinc-800')
  })

  it('applies primary variant', () => {
    const html = linkButton({ label: 'Go', href: '/path', variant: 'primary' })
    expect(html).toContain('bg-zinc-100')
  })

  it('escapes HTML in label', () => {
    const html = linkButton({ label: '<em>Link</em>', href: '/path' })
    expect(html).toContain('&lt;em&gt;')
  })

  it('applies small size class', () => {
    const html = linkButton({ label: 'Go', href: '/path', size: 'sm' })
    expect(html).toContain('text-sm')
  })
})

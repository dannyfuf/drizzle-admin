import { describe, it, expect } from 'vitest'
import { renderFlash, escapeHtml } from './flash.js'

describe('renderFlash', () => {
  it('returns empty string when no flash', () => {
    expect(renderFlash(null)).toBe('')
  })

  it('renders success flash', () => {
    const html = renderFlash({ type: 'success', message: 'Created!' })
    expect(html).toContain('bg-emerald-900/50')
    expect(html).toContain('Created!')
  })

  it('renders error flash', () => {
    const html = renderFlash({ type: 'error', message: 'Failed!' })
    expect(html).toContain('bg-red-900/50')
    expect(html).toContain('Failed!')
  })

  it('renders info flash', () => {
    const html = renderFlash({ type: 'info', message: 'Note' })
    expect(html).toContain('bg-blue-900/50')
    expect(html).toContain('Note')
  })

  it('escapes HTML in message', () => {
    const html = renderFlash({ type: 'error', message: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;')
  })

  it('leaves normal text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

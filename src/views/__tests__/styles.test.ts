import { describe, it, expect } from 'vitest'
import { styles, tailwindScript } from '@/views/styles.ts'

describe('styles', () => {
  it('has expected keys', () => {
    expect(styles).toHaveProperty('bg')
    expect(styles).toHaveProperty('text')
    expect(styles).toHaveProperty('btnPrimary')
    expect(styles).toHaveProperty('btnSecondary')
    expect(styles).toHaveProperty('btnDanger')
    expect(styles).toHaveProperty('btnGhost')
    expect(styles).toHaveProperty('input')
    expect(styles).toHaveProperty('card')
    expect(styles).toHaveProperty('table')
  })

  it('all style values are non-empty strings', () => {
    for (const [key, value] of Object.entries(styles)) {
      expect(typeof value).toBe('string')
      expect(value.length, `styles.${key} should not be empty`).toBeGreaterThan(0)
    }
  })
})

describe('tailwindScript', () => {
  it('contains script tag with CDN URL', () => {
    expect(tailwindScript).toContain('<script')
    expect(tailwindScript).toContain('cdn.tailwindcss.com')
  })
})

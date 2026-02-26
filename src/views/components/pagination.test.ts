import { describe, it, expect } from 'vitest'
import { renderPagination } from './pagination.js'

describe('renderPagination', () => {
  it('returns empty string for single page', () => {
    expect(renderPagination({ currentPage: 1, totalPages: 1, baseUrl: '/cards' })).toBe('')
  })

  it('renders page links', () => {
    const html = renderPagination({ currentPage: 1, totalPages: 3, baseUrl: '/cards' })
    expect(html).toContain('page=1')
    expect(html).toContain('page=2')
    expect(html).toContain('page=3')
  })

  it('highlights current page', () => {
    const html = renderPagination({ currentPage: 2, totalPages: 3, baseUrl: '/cards' })
    expect(html).toContain('bg-zinc-700')
  })

  it('disables previous on first page', () => {
    const html = renderPagination({ currentPage: 1, totalPages: 3, baseUrl: '/cards' })
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('Previous')
  })

  it('disables next on last page', () => {
    const html = renderPagination({ currentPage: 3, totalPages: 3, baseUrl: '/cards' })
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('Next')
  })

  it('shows ellipsis for many pages', () => {
    const html = renderPagination({ currentPage: 5, totalPages: 10, baseUrl: '/cards' })
    expect(html).toContain('...')
  })
})

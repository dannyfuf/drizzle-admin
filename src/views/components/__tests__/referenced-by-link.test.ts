import { describe, expect, it } from 'vitest'
import { referencedByLink } from '@/views/components/referenced-by-link.ts'

describe('referencedByLink', () => {
  it('renders a filtered child index link under the admin base path', () => {
    const html = referencedByLink({
      label: 'Comments',
      childRoutePath: 'comments',
      foreignKey: 'postId',
      value: 42,
      basePath: '/admin',
    })

    expect(html).toContain('href="/admin/comments?filter_postId=42"')
    expect(html).toContain('>Comments</a>')
  })

  it('encodes unsafe filter values and escapes the label', () => {
    const html = referencedByLink({
      label: '<Comments>',
      childRoutePath: 'comments',
      foreignKey: 'postId',
      value: '<post & 42>',
      basePath: '',
    })

    expect(html).toContain('href="/comments?filter_postId=%3Cpost+%26+42%3E"')
    expect(html).toContain('&lt;Comments&gt;')
    expect(html).not.toContain('><Comments></a>')
  })
})

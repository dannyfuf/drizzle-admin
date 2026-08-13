import { describe, expect, it } from 'vitest'
import { pgTable, serial } from 'drizzle-orm/pg-core'
import { createResourceUrls } from '@/index.ts'

const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
})

describe('createResourceUrls', () => {
  it('builds resource paths without an origin', () => {
    const urls = createResourceUrls({ basePath: '/admin' })

    expect(urls.index('blog_posts')).toEqual({ path: '/admin/blog-posts', url: '/admin/blog-posts' })
    expect(urls.show('blog_posts', 42)).toEqual({ path: '/admin/blog-posts/42', url: '/admin/blog-posts/42' })
    expect(urls.edit('blog_posts', 42)).toEqual({ path: '/admin/blog-posts/42/edit', url: '/admin/blog-posts/42/edit' })
    expect(urls.new('blog_posts')).toEqual({ path: '/admin/blog-posts/new', url: '/admin/blog-posts/new' })
  })

  it('builds absolute URLs and strips trailing slashes from the origin', () => {
    const urls = createResourceUrls({ basePath: '/admin', origin: 'https://app.example.com/' })

    expect(urls.show('posts', 1)).toEqual({
      path: '/admin/posts/1',
      url: 'https://app.example.com/admin/posts/1',
    })
  })

  it('accepts a Drizzle table', () => {
    expect(createResourceUrls().index(blogPosts)).toEqual({
      path: '/blog-posts',
      url: '/blog-posts',
    })
  })

  it('builds an index URL with a single filter', () => {
    expect(createResourceUrls().index('comments', { filters: { postId: 42 } })).toEqual({
      path: '/comments?filter_postId=42',
      url: '/comments?filter_postId=42',
    })
  })

  it('builds an index URL with multiple filters', () => {
    expect(createResourceUrls().index('comments', {
      filters: { postId: 42, status: 'approved' },
    }).path).toBe('/comments?filter_postId=42&filter_status=approved')
  })

  it('URL-encodes filter values', () => {
    expect(createResourceUrls().index('comments', {
      filters: { search: 'hello world & more' },
    }).path).toBe('/comments?filter_search=hello+world+%26+more')
  })

  it('includes filters with basePath and origin', () => {
    const urls = createResourceUrls({
      basePath: '/admin',
      origin: 'https://app.example.com',
    })

    expect(urls.index('comments', { filters: { postId: 42 } })).toEqual({
      path: '/admin/comments?filter_postId=42',
      url: 'https://app.example.com/admin/comments?filter_postId=42',
    })
  })

  it('URL-encodes record IDs', () => {
    expect(createResourceUrls().show('posts', 'a/b c')).toEqual({
      path: '/posts/a%2Fb%20c',
      url: '/posts/a%2Fb%20c',
    })
  })

  it('normalizes a trailing slash in basePath', () => {
    expect(createResourceUrls({ basePath: '/admin/' }).index('posts').path).toBe('/admin/posts')
  })

  it('rejects a basePath without a leading slash', () => {
    expect(() => createResourceUrls({ basePath: 'admin' })).toThrow('basePath must start with "/"')
  })

  it('rejects double slashes in basePath', () => {
    expect(() => createResourceUrls({ basePath: '//admin' })).toThrow('basePath must not contain "//"')
  })
})

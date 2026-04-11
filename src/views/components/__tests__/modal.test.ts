import { describe, it, expect, beforeEach } from 'vitest'
import { confirmModal, modalTrigger, modalScript } from '@/views/components/modal.ts'

describe('confirmModal', () => {
  it('renders hidden dialog with id', () => {
    const html = confirmModal({
      id: 'test-modal',
      title: 'Confirm',
      message: 'Are you sure?',
      formAction: '/action',
      csrfToken: 'token',
    })
    expect(html).toContain('id="test-modal"')
    expect(html).toContain('hidden')
  })

  it('includes escaped title', () => {
    const html = confirmModal({
      id: 'modal',
      title: 'Delete <Item>',
      message: 'Sure?',
      formAction: '/action',
      csrfToken: 'token',
    })
    expect(html).toContain('&lt;Item&gt;')
  })

  it('includes escaped message', () => {
    const html = confirmModal({
      id: 'modal',
      title: 'Confirm',
      message: 'Delete <b>this</b>?',
      formAction: '/action',
      csrfToken: 'token',
    })
    expect(html).toContain('&lt;b&gt;')
  })

  it('renders confirm button with specified label', () => {
    const html = confirmModal({
      id: 'modal',
      title: 'Confirm',
      message: 'Sure?',
      confirmLabel: 'Yes, delete',
      formAction: '/action',
      csrfToken: 'token',
    })
    expect(html).toContain('Yes, delete')
  })

  it('uses danger class for danger variant', () => {
    const html = confirmModal({
      id: 'modal',
      title: 'Confirm',
      message: 'Sure?',
      confirmVariant: 'danger',
      formAction: '/action',
      csrfToken: 'token',
    })
    expect(html).toContain('bg-red-600')
  })

  it('uses primary class for primary variant', () => {
    const html = confirmModal({
      id: 'modal',
      title: 'Confirm',
      message: 'Sure?',
      confirmVariant: 'primary',
      formAction: '/action',
      csrfToken: 'token',
    })
    expect(html).toContain('bg-zinc-100')
  })

  it('includes CSRF hidden input', () => {
    const html = confirmModal({
      id: 'modal',
      title: 'Confirm',
      message: 'Sure?',
      formAction: '/action',
      csrfToken: 'my-token',
    })
    expect(html).toContain('name="_csrf"')
    expect(html).toContain('value="my-token"')
  })

  it('renders form with specified action URL', () => {
    const html = confirmModal({
      id: 'modal',
      title: 'Confirm',
      message: 'Sure?',
      formAction: '/items/1?_method=DELETE',
      csrfToken: 'token',
    })
    expect(html).toContain('action="/items/1?_method=DELETE"')
  })

  it('includes Cancel button', () => {
    const html = confirmModal({
      id: 'modal',
      title: 'Confirm',
      message: 'Sure?',
      formAction: '/action',
      csrfToken: 'token',
    })
    expect(html).toContain('Cancel')
  })
})

describe('modalTrigger', () => {
  it('renders button that calls openModal with id', () => {
    const html = modalTrigger('my-modal', 'Delete')
    expect(html).toContain("openModal('my-modal')")
  })

  it('applies danger class for danger variant', () => {
    const html = modalTrigger('modal', 'Delete', 'danger')
    expect(html).toContain('bg-red-600')
  })

  it('applies secondary class by default', () => {
    const html = modalTrigger('modal', 'Action')
    expect(html).toContain('bg-zinc-800')
  })

  it('escapes label text', () => {
    const html = modalTrigger('modal', '<b>Delete</b>')
    expect(html).toContain('&lt;b&gt;')
  })
})

describe('modalScript', () => {
  it('contains openModal function', () => {
    expect(modalScript).toContain('function openModal')
  })

  it('contains closeModal function', () => {
    expect(modalScript).toContain('function closeModal')
  })

  it('contains Escape key handler', () => {
    expect(modalScript).toContain('Escape')
  })
})

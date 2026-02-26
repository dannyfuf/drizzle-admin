import type { ResourceDefinition } from '../../resources/types.js'
import { confirmModal, modalTrigger } from './modal.js'
import { escapeHtml } from './flash.js'
import { styles } from '../styles.js'

export interface MemberActionsProps {
  resource: ResourceDefinition
  recordId: string | number
  csrfToken: string
}

export function renderMemberActions(props: MemberActionsProps): { buttons: string; modals: string } {
  const { resource, recordId, csrfToken } = props
  const actions = resource.options.memberActions ?? []

  if (actions.length === 0) {
    return { buttons: '', modals: '' }
  }

  const buttons: string[] = []
  const modals: string[] = []

  for (const action of actions) {
    const actionSlug = slugify(action.name)
    const actionUrl = `/${resource.routePath}/${recordId}/actions/${actionSlug}`
    const modalIdStr = `modal-${actionSlug}-${recordId}`
    const isDestructive = action.destructive !== false

    if (isDestructive) {
      buttons.push(modalTrigger(modalIdStr, action.name, 'danger'))
      modals.push(confirmModal({
        id: modalIdStr,
        title: action.name,
        message: `Are you sure you want to ${action.name.toLowerCase()} this ${resource.displayName.toLowerCase()}?`,
        confirmLabel: action.name,
        confirmVariant: 'danger',
        formAction: actionUrl,
        csrfToken,
      }))
    } else {
      buttons.push(`
        <form method="POST" action="${actionUrl}" class="inline">
          <input type="hidden" name="_csrf" value="${csrfToken}">
          <button type="submit" class="${styles.btnSecondary}">
            ${escapeHtml(action.name)}
          </button>
        </form>
      `)
    }
  }

  return {
    buttons: buttons.join(''),
    modals: modals.join(''),
  }
}

export interface CollectionActionsProps {
  resource: ResourceDefinition
  csrfToken: string
}

export function renderCollectionActions(props: CollectionActionsProps): string {
  const { resource, csrfToken } = props
  const actions = resource.options.collectionActions ?? []

  if (actions.length === 0) {
    return ''
  }

  return actions.map(action => {
    const actionSlug = slugify(action.name)
    const actionUrl = `/${resource.routePath}/actions/${actionSlug}`

    return `
      <form method="POST" action="${actionUrl}" class="inline">
        <input type="hidden" name="_csrf" value="${csrfToken}">
        <button type="submit" class="${styles.btnSecondary}">
          ${escapeHtml(action.name)}
        </button>
      </form>
    `
  }).join('')
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

import { styles } from '../styles.js'
import { escapeHtml } from './flash.js'

let modalId = 0

export interface ConfirmModalProps {
  id?: string
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  formAction: string
  csrfToken: string
}

export function confirmModal(props: ConfirmModalProps): string {
  const {
    title,
    message,
    confirmLabel = 'Confirm',
    confirmVariant = 'danger',
    formAction,
    csrfToken,
  } = props

  const id = props.id ?? `modal-${++modalId}`
  const confirmClass = confirmVariant === 'danger' ? styles.btnDanger : styles.btnPrimary

  return `
    <div id="${id}" class="fixed inset-0 z-50 hidden" aria-modal="true" role="dialog">
      <div class="absolute inset-0 bg-black/60" onclick="closeModal('${id}')"></div>
      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="${styles.card} w-full max-w-md p-6 relative">
          <h3 class="text-lg font-semibold text-zinc-100">${escapeHtml(title)}</h3>
          <p class="${styles.textMuted} mt-2">${escapeHtml(message)}</p>
          <div class="flex items-center justify-end gap-2 mt-6">
            <button type="button" onclick="closeModal('${id}')" class="${styles.btnGhost}">
              Cancel
            </button>
            <form method="POST" action="${formAction}" class="inline">
              <input type="hidden" name="_csrf" value="${csrfToken}">
              <button type="submit" class="${confirmClass}">
                ${escapeHtml(confirmLabel)}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `
}

export function modalTrigger(modalId: string, label: string, variant: 'danger' | 'secondary' = 'secondary'): string {
  const className = variant === 'danger' ? styles.btnDanger : styles.btnSecondary

  return `
    <button type="button" onclick="openModal('${modalId}')" class="${className}">
      ${escapeHtml(label)}
    </button>
  `
}

export const modalScript = `
<script>
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('[role="dialog"]:not(.hidden)').forEach(modal => {
        closeModal(modal.id);
      });
    }
  });
</script>
`

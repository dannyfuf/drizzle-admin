import type { FlashMessage } from '../../utils/flash.js'
import { styles } from '../styles.js'

export function renderFlash(flash: FlashMessage | null): string {
  if (!flash) return ''

  const colorClasses = {
    success: 'bg-emerald-900/50 border-emerald-700 text-emerald-200',
    error: 'bg-red-900/50 border-red-700 text-red-200',
    info: 'bg-blue-900/50 border-blue-700 text-blue-200',
  }

  return `
    <div class="mb-6 p-4 rounded-lg border ${colorClasses[flash.type]}" role="alert">
      <div class="flex items-center justify-between">
        <span>${escapeHtml(flash.message)}</span>
        <button
          type="button"
          onclick="this.parentElement.parentElement.remove()"
          class="text-current opacity-70 hover:opacity-100"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

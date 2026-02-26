import { styles } from '../styles.js'
import { escapeHtml } from './flash.js'

export interface ButtonProps {
  label: string
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function button(props: ButtonProps): string {
  const { label, type = 'button', variant = 'primary', size = 'md', disabled = false } = props

  const variantClass = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    danger: styles.btnDanger,
    ghost: styles.btnGhost,
  }[variant]

  const sizeClass = size === 'sm' ? 'text-sm px-3 py-1.5' : ''

  return `
    <button
      type="${type}"
      class="${variantClass} ${sizeClass}"
      ${disabled ? 'disabled' : ''}
    >
      ${escapeHtml(label)}
    </button>
  `
}

export interface LinkButtonProps {
  label: string
  href: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export function linkButton(props: LinkButtonProps): string {
  const { label, href, variant = 'secondary', size = 'md' } = props

  const variantClass = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    danger: styles.btnDanger,
    ghost: styles.btnGhost,
  }[variant]

  const sizeClass = size === 'sm' ? 'text-sm px-3 py-1.5' : ''

  return `
    <a href="${href}" class="${variantClass} ${sizeClass} inline-block text-center no-underline">
      ${escapeHtml(label)}
    </a>
  `
}

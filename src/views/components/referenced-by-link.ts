import { adminUrl } from '@/utils/url.ts'
import { escapeHtml } from '@/views/components/flash.ts'
import { styles } from '@/views/styles.ts'

export interface ReferencedByRoute {
  label: string
  childRoutePath: string
  foreignKey: string
  parentKeyName: string
}

interface ReferencedByLinkProps {
  label: string
  childRoutePath: string
  foreignKey: string
  value: unknown
  basePath: string
}

/** Renders a link to child records filtered by their foreign-key value. */
export function referencedByLink(props: ReferencedByLinkProps): string {
  const { label, childRoutePath, foreignKey, value, basePath } = props
  const searchParams = new URLSearchParams({ [`filter_${foreignKey}`]: String(value) })
  const href = adminUrl(basePath, `/${childRoutePath}?${searchParams.toString()}`)

  return `<a href="${href}" class="${styles.link}">${escapeHtml(label)}</a>`
}

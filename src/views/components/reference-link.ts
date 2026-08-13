import { adminUrl } from '@/utils/url.ts'
import { escapeHtml } from '@/views/components/flash.ts'
import { styles } from '@/views/styles.ts'

interface ReferenceLinkProps {
  value: unknown
  routePath: string
  basePath: string
}

/** Renders a link from a foreign-key value to its registered resource. */
export function referenceLink(props: ReferenceLinkProps): string {
  const { value, routePath, basePath } = props
  const href = adminUrl(basePath, `/${routePath}/${encodeURIComponent(String(value))}`)

  return `<a href="${href}" class="${styles.link}">${escapeHtml(String(value))}</a>`
}

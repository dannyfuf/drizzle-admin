export interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
}

export function renderPagination(props: PaginationProps): string {
  const { currentPage, totalPages, baseUrl } = props

  if (totalPages <= 1) return ''

  const pages: (number | '...')[] = []

  pages.push(1)

  if (currentPage > 3) {
    pages.push('...')
  }

  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    if (!pages.includes(i)) {
      pages.push(i)
    }
  }

  if (currentPage < totalPages - 2) {
    pages.push('...')
  }

  if (totalPages > 1 && !pages.includes(totalPages)) {
    pages.push(totalPages)
  }

  const pageLinks = pages.map(page => {
    if (page === '...') {
      return `<span class="text-zinc-400 px-2">...</span>`
    }

    const isActive = page === currentPage
    const className = isActive
      ? 'px-3 py-1 rounded bg-zinc-700 text-zinc-100'
      : 'px-3 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'

    return `<a href="${baseUrl}?page=${page}" class="${className}">${page}</a>`
  }).join('')

  const prevDisabled = currentPage === 1
  const nextDisabled = currentPage === totalPages

  return `
    <nav class="flex items-center justify-center gap-1 mt-6" aria-label="Pagination">
      <a
        href="${baseUrl}?page=${currentPage - 1}"
        class="px-3 py-1 rounded ${prevDisabled ? 'text-zinc-600 pointer-events-none' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
        ${prevDisabled ? 'aria-disabled="true"' : ''}
      >
        Previous
      </a>
      ${pageLinks}
      <a
        href="${baseUrl}?page=${currentPage + 1}"
        class="px-3 py-1 rounded ${nextDisabled ? 'text-zinc-600 pointer-events-none' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
        ${nextDisabled ? 'aria-disabled="true"' : ''}
      >
        Next
      </a>
    </nav>
  `
}

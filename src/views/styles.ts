export const styles = {
  bg: 'bg-zinc-950',
  bgCard: 'bg-zinc-900',
  bgHover: 'hover:bg-zinc-800',
  border: 'border border-zinc-800',

  text: 'text-zinc-100',
  textMuted: 'text-zinc-400',
  textError: 'text-red-400',
  textSuccess: 'text-emerald-400',

  btnPrimary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-medium px-4 py-2 rounded-lg transition-colors',
  btnSecondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 font-medium px-4 py-2 rounded-lg border border-zinc-700 transition-colors',
  btnDanger: 'bg-red-600 text-white hover:bg-red-700 font-medium px-4 py-2 rounded-lg transition-colors',
  btnGhost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 px-4 py-2 rounded-lg transition-colors',

  input: 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent',
  label: 'block text-sm font-medium text-zinc-300 mb-1',
  checkbox: 'w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-zinc-600',

  card: 'bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm',
  cardPadded: 'bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm p-6',

  table: 'w-full',
  tableHeader: 'text-left text-sm font-medium text-zinc-400 uppercase tracking-wider',
  tableRow: 'border-b border-zinc-800 hover:bg-zinc-800/50',
  tableCell: 'px-4 py-3 text-sm text-zinc-300',

  link: 'text-zinc-100 hover:text-white underline underline-offset-4',
  navLink: 'flex items-center gap-2 px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors',
  navLinkActive: 'flex items-center gap-2 px-3 py-2 text-zinc-100 bg-zinc-800 rounded-lg',
}

export const tailwindScript = `
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          zinc: {
            950: '#09090b',
          }
        }
      }
    }
  }
</script>
`

export function formatTimestamp(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return 'Invalid Date'
  }

  return `${value.toISOString().slice(0, 19)}Z`
}

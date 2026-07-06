import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '@/utils/date.ts'

describe('formatTimestamp', () => {
  it('formats dates as ISO 8601 UTC without milliseconds', () => {
    expect(formatTimestamp(new Date('2024-01-15T10:30:00Z'))).toBe('2024-01-15T10:30:00Z')
  })

  it('normalizes non-UTC input to UTC', () => {
    expect(formatTimestamp(new Date('2024-01-15T10:30:00-03:00'))).toBe('2024-01-15T13:30:00Z')
  })

  it('drops milliseconds', () => {
    expect(formatTimestamp(new Date('2024-01-15T10:30:00.789Z'))).toBe('2024-01-15T10:30:00Z')
  })

  it('does not throw on invalid dates', () => {
    expect(formatTimestamp(new Date('not-a-date'))).toBe('Invalid Date')
  })
})

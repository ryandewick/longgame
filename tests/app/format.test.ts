import { describe, expect, it } from 'vitest'
import { formatLongHours } from '~~/app/utils/format'

describe('formatLongHours', () => {
  it('spells hours out for a sentence', () => {
    expect(formatLongHours(1956.4)).toBe('1,956 hours')
    expect(formatLongHours(2.5)).toBe('2.5 hours')
  })

  it('leaves minutes as they are', () => {
    expect(formatLongHours(0.5)).toBe('30 min')
  })
})

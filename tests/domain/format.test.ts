import { describe, expect, it } from 'vitest'
import {
  COST_LABELS,
  INTENSITY_LABELS,
  dayKey,
  formatClock,
  formatHours,
  formatNumber,
  formatShortNumber,
  formatTimeAgo,
  formatWait,
} from '#shared/domain/format'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('labels', () => {
  it('names every intensity and cost', () => {
    expect(INTENSITY_LABELS).toEqual({ afk: 'AFK', semi: 'Semi-AFK', active: 'Active' })
    expect(COST_LABELS).toEqual({ profit: 'pays', free: 'free', cheap: 'cheap', pricey: 'pricey' })
  })
})

describe('formatNumber', () => {
  it('rounds and separates thousands', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999.5)).toBe('1,000')
    expect(formatNumber(13_034_431)).toBe('13,034,431')
  })
})

describe('formatShortNumber', () => {
  it.each([
    [0, '0'],
    [950.4, '950'],
    [1_000, '1k'],
    [12_499, '12k'],
    [999_499, '999k'],
    [1_000_000, '1M'],
    [1_250_000, '1.25M'],
    [1_500_000, '1.5M'],
    [10_000_000, '10M'],
    [13_034_431, '13.03M'],
    [200_000_000, '200M'],
  ])('writes %d as %s', (value, text) => {
    expect(formatShortNumber(value)).toBe(text)
  })
})

describe('formatHours', () => {
  it.each([
    [0, '0 min'],
    [0.5, '30 min'],
    [0.99, '59 min'],
    [1, '1 h'],
    [2.5, '2.5 h'],
    [9.96, '10 h'],
    [10, '10 h'],
    [1_204.4, '1,204 h'],
  ])('writes %d hours as %s', (hours, text) => {
    expect(formatHours(hours)).toBe(text)
  })
})

describe('formatClock', () => {
  it('shows minutes and seconds, padded', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(7 * MINUTE + 5_000)).toBe('07:05')
    expect(formatClock(59_999)).toBe('00:59')
  })

  it('keeps counting minutes past the hour', () => {
    expect(formatClock(75 * MINUTE)).toBe('75:00')
    expect(formatClock(125 * MINUTE + 30_000)).toBe('125:30')
  })

  it('never goes below zero', () => {
    expect(formatClock(-5_000)).toBe('00:00')
  })
})

describe('formatTimeAgo', () => {
  const NOW = 1_800_000_000_000

  it.each([
    [30_000, 'just now'],
    [MINUTE, '1 min ago'],
    [59 * MINUTE, '59 min ago'],
    [HOUR, '1 h ago'],
    [23 * HOUR, '23 h ago'],
    [DAY, '1 d ago'],
    [8 * DAY + HOUR, '8 d ago'],
  ])('writes %d ms ago as %s', (ago, text) => {
    expect(formatTimeAgo(NOW - ago, NOW)).toBe(text)
  })
})

describe('formatWait', () => {
  it.each([
    [1, '1 min'],
    [MINUTE, '1 min'],
    [MINUTE + 1, '2 min'],
    [59 * MINUTE, '59 min'],
    [HOUR, '1 h'],
    [HOUR + 1, '2 h'],
    [36 * HOUR, '36 h'],
    [2 * DAY, '2 days'],
    [2 * DAY + 1, '3 days'],
  ])('rounds %d ms up to %s', (milliseconds, text) => {
    expect(formatWait(milliseconds)).toBe(text)
  })
})

describe('dayKey', () => {
  it('is the local calendar day, zero padded', () => {
    expect(dayKey(new Date(2026, 9, 10, 12).getTime())).toBe('2026-10-10')
    expect(dayKey(new Date(2027, 0, 5, 12).getTime())).toBe('2027-01-05')
  })

  it('changes at local midnight', () => {
    expect(dayKey(new Date(2026, 9, 10, 23, 59, 59).getTime())).toBe('2026-10-10')
    expect(dayKey(new Date(2026, 9, 11, 0, 0, 0).getTime())).toBe('2026-10-11')
  })

  it('sorts as text in date order', () => {
    const days = [new Date(2026, 9, 10), new Date(2026, 8, 30), new Date(2026, 9, 2)].map((date) =>
      dayKey(date.getTime()),
    )
    expect([...days].sort()).toEqual(['2026-09-30', '2026-10-02', '2026-10-10'])
  })
})

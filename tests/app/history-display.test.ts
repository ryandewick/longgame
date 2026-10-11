import { describe, expect, it } from 'vitest'
import type { HistoryBlock } from '#shared/types/session'
import { RESETS } from '#shared/data/resets'
import type { DailyGain } from '#shared/domain/pace'
import {
  describeHistoryBlock,
  describeLevelsGained,
  formatSessionDate,
  historyBlockSkill,
  historyChartBars,
  historyCountsSentence,
  xpThisWeek,
} from '~~/app/utils/history-display'

/** As many days as there are gains, the last being Saturday 10 October 2026. */
function gainsEnding(...xp: number[]): DailyGain[] {
  return xp.map((gained, index) => {
    const dayOfMonth = 10 - (xp.length - 1 - index)
    return { day: `2026-10-${String(dayOfMonth).padStart(2, '0')}`, xp: gained, weekday: 'Sa' }
  })
}

describe('xpThisWeek', () => {
  it('adds up the last seven days and no more', () => {
    expect(xpThisWeek(gainsEnding(1000, 500, 1, 2, 3, 4, 5, 6, 7))).toBe(28)
  })

  it('adds up what there is when there are fewer than seven', () => {
    expect(xpThisWeek(gainsEnding(10, 20))).toBe(30)
    expect(xpThisWeek([])).toBe(0)
  })
})

describe('historyCountsSentence', () => {
  it('counts the streak, the sessions and the snapshots', () => {
    expect(historyCountsSentence({ dayStreak: 2, sessions: 6, snapshots: 22 })).toBe(
      '2 days in a row. 6 sessions finished, 22 snapshots taken.',
    )
  })

  it('drops the s for exactly one, and keeps it for none', () => {
    expect(historyCountsSentence({ dayStreak: 1, sessions: 1, snapshots: 1 })).toBe(
      '1 day in a row. 1 session finished, 1 snapshot taken.',
    )
    expect(historyCountsSentence({ dayStreak: 0, sessions: 0, snapshots: 0 })).toBe(
      '0 days in a row. 0 sessions finished, 0 snapshots taken.',
    )
  })
})

describe('historyChartBars', () => {
  const bars = historyChartBars(gainsEnding(0, 86_000, 172_000, 43_210))

  it('measures each bar against the best day, to a tenth of a percent', () => {
    expect(bars.map((bar) => bar.heightPercent)).toEqual([0, 50, 100, 25.1])
  })

  it('writes the gain above a bar, and nothing above a day with none', () => {
    expect(bars.map((bar) => bar.label)).toEqual(['', '+86k', '+172k', '+43k'])
  })

  it('marks the last day as today', () => {
    expect(bars.map((bar) => bar.isToday)).toEqual([false, false, false, true])
  })

  it('gives each bar a tooltip and a description in words', () => {
    expect(bars.map((bar) => bar.title)).toEqual([
      '2026-10-07 +0',
      '2026-10-08 +86k',
      '2026-10-09 +172k',
      '2026-10-10 +43k',
    ])
    expect(bars.map((bar) => bar.description)).toEqual([
      'Wednesday 7 October: no xp',
      'Thursday 8 October: +86k xp',
      'Friday 9 October: +172k xp',
      'Saturday 10 October: +43k xp',
    ])
  })

  it('carries the day and its two letters through', () => {
    expect(bars[0]).toMatchObject({ day: '2026-10-07', weekday: 'Sa' })
  })

  it('draws every bar flat when nothing was gained on any day', () => {
    const flat = historyChartBars(gainsEnding(0, 0, 0))
    expect(flat.map((bar) => bar.heightPercent)).toEqual([0, 0, 0])
    expect(flat.map((bar) => bar.label)).toEqual(['', '', ''])
  })

  it('has no bars for no days', () => {
    expect(historyChartBars([])).toEqual([])
  })
})

describe('historyBlockSkill and describeHistoryBlock', () => {
  const skillBlock: HistoryBlock = {
    kind: 'skill',
    skill: 'ranged',
    title: 'Chinning',
    done: true,
  }
  const resetBlock: HistoryBlock = {
    kind: 'reset',
    resetKey: 'birdhouse',
    title: 'Birdhouse run',
    done: true,
  }
  const wildcardBlock: HistoryBlock = { kind: 'wildcard', title: 'Clue scroll', done: false }

  it('gives a skill block its own skill, and names the skill before the method', () => {
    expect(historyBlockSkill(skillBlock)).toBe('ranged')
    expect(describeHistoryBlock(skillBlock)).toBe('Ranged: Chinning')
  })

  it('gives a reset block the skill its reset trains, and its title alone', () => {
    expect(historyBlockSkill(resetBlock)).toBe('hunter')
    expect(describeHistoryBlock(resetBlock)).toBe('Birdhouse run')
  })

  it('gives no skill to a reset that trains none, or that the data no longer has', () => {
    const untrained = RESETS.find((reset) => reset.skill === null)
    expect(untrained).toBeDefined()
    expect(historyBlockSkill({ ...resetBlock, resetKey: untrained?.key ?? '' })).toBeNull()
    expect(historyBlockSkill({ ...resetBlock, resetKey: 'dropped' })).toBeNull()
  })

  it('gives a wildcard no skill and its title alone', () => {
    expect(historyBlockSkill(wildcardBlock)).toBeNull()
    expect(describeHistoryBlock(wildcardBlock)).toBe('Clue scroll')
  })
})

describe('describeLevelsGained', () => {
  it('lists each skill with the levels it gained, in the order the tally has them', () => {
    expect(describeLevelsGained({ ranged: 1, crafting: 3 })).toBe('Ranged +1, Crafting +3')
  })

  it('is empty for a session that gained no level', () => {
    expect(describeLevelsGained({})).toBe('')
  })
})

describe('formatSessionDate', () => {
  it('gives the day with two digits and the month in short', () => {
    expect(formatSessionDate(new Date(2026, 9, 5, 23, 30).getTime())).toBe('05 Oct')
    expect(formatSessionDate(new Date(2026, 11, 25, 0, 5).getTime())).toBe('25 Dec')
  })
})

import { describe, expect, it } from 'vitest'
import type { HistoryEntry } from '#shared/types/session'
import type { SkillKey } from '#shared/types/skill'
import type { XpSnapshot } from '#shared/types/snapshot'
import { dailyGains, dayStreak, paceOver } from '#shared/domain/pace'

const HOUR = 3_600_000

/** A moment in October 2026 in the machine's own time zone, which is the zone the rules use. */
const at = (day: number, hour = 12): number => new Date(2026, 9, day, hour).getTime()

const snapshot = (
  takenAt: number,
  totalXp: number,
  skills: Partial<Record<SkillKey, number>> = {},
): XpSnapshot => ({ takenAt, totalXp, skills })

const sessionOn = (endedAt: number, gained: number): HistoryEntry => ({
  endedAt,
  minutes: 60,
  elapsed: 0,
  gains: gained ? { mining: gained } : {},
  totalXp: gained,
  levels: {},
  blocks: [],
})

describe('paceOver', () => {
  const NOW = at(10, 18)

  it('has no pace without snapshots', () => {
    expect(paceOver([], 7, NOW)).toEqual({ xpPerDay: 0, days: 0 })
  })

  it('measures total XP from the first snapshot in the window to the latest', () => {
    const snapshots = [snapshot(at(1), 1_000), snapshot(at(6), 50_000), snapshot(at(10), 90_000)]
    // seven days back from the 10th reaches the 3rd, so the snapshot from the 1st is outside
    expect(paceOver(snapshots, 7, NOW)).toEqual({ xpPerDay: 10_000, days: 4 })
    expect(paceOver(snapshots, 30, NOW).xpPerDay).toBeCloseTo(89_000 / 9, 6)
  })

  it('measures one skill when asked', () => {
    const snapshots = [
      snapshot(at(6), 50_000, { mining: 2_000, fishing: 500 }),
      snapshot(at(10), 90_000, { mining: 10_000, fishing: 500 }),
    ]
    expect(paceOver(snapshots, 7, NOW, 'mining').xpPerDay).toBe(2_000)
    expect(paceOver(snapshots, 7, NOW, 'fishing').xpPerDay).toBe(0)
  })

  it('counts a skill missing from a snapshot as zero XP', () => {
    const snapshots = [snapshot(at(6), 0), snapshot(at(10), 0, { sailing: 4_000 })]
    expect(paceOver(snapshots, 7, NOW, 'sailing').xpPerDay).toBe(1_000)
  })

  it('has no pace when the snapshots span less than a fifth of a day', () => {
    const snapshots = [snapshot(at(10, 12), 1_000), snapshot(at(10, 16), 90_000)]
    const pace = paceOver(snapshots, 7, NOW)
    expect(pace.xpPerDay).toBe(0)
    expect(pace.days).toBeCloseTo(4 / 24, 10)
  })

  it('has no pace when nothing was recorded inside the window', () => {
    const snapshots = [snapshot(at(1), 1_000), snapshot(at(2), 90_000)]
    expect(paceOver(snapshots, 3, NOW)).toEqual({ xpPerDay: 0, days: 0 })
  })
})

describe('dailyGains', () => {
  const NOW = at(10, 18)

  it('gives one entry a day, oldest first, ending today', () => {
    const gains = dailyGains([], 4, NOW)
    expect(gains.map((gain) => gain.day)).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ])
    expect(gains.map((gain) => gain.weekday)).toEqual(['We', 'Th', 'Fr', 'Sa'])
    expect(gains.every((gain) => gain.xp === 0)).toBe(true)
  })

  it('measures a day from the last snapshot of the day before to its own last snapshot', () => {
    const snapshots = [
      snapshot(at(8, 9), 100),
      snapshot(at(8, 21), 400),
      snapshot(at(9, 9), 450),
      snapshot(at(9, 21), 1_000),
    ]
    const gains = dailyGains(snapshots, 3, NOW)
    expect(gains.map((gain) => gain.xp)).toEqual([300, 600, 0])
  })

  it('measures the first day on record from its own first snapshot', () => {
    const snapshots = [snapshot(at(9, 9), 5_000), snapshot(at(9, 21), 5_700)]
    expect(dailyGains(snapshots, 2, NOW).map((gain) => gain.xp)).toEqual([700, 0])
  })

  it('puts XP gained across a gap on the day it was next recorded', () => {
    const snapshots = [snapshot(at(6), 1_000), snapshot(at(9), 4_000)]
    expect(dailyGains(snapshots, 5, NOW).map((gain) => gain.xp)).toEqual([0, 0, 0, 3_000, 0])
  })

  it('never reports a loss', () => {
    const snapshots = [snapshot(at(9), 4_000), snapshot(at(10), 3_000)]
    expect(dailyGains(snapshots, 1, NOW).map((gain) => gain.xp)).toEqual([0])
  })

  it('files a late-night snapshot under the evening it was taken', () => {
    const snapshots = [snapshot(at(9, 12), 0), snapshot(at(9, 23) + 30 * 60_000, 800)]
    expect(dailyGains(snapshots, 2, NOW).map((gain) => gain.xp)).toEqual([800, 0])
  })
})

describe('dayStreak', () => {
  const NOW = at(10, 18)

  it('is zero with nothing on record', () => {
    expect(dayStreak([], [], NOW)).toBe(0)
  })

  it('counts consecutive days with a session that gained XP, up to today', () => {
    const history = [sessionOn(at(10), 500), sessionOn(at(9), 500), sessionOn(at(8), 500)]
    expect(dayStreak(history, [], NOW)).toBe(3)
  })

  it('is not broken by today while today is still to come', () => {
    const history = [sessionOn(at(9), 500), sessionOn(at(8), 500)]
    expect(dayStreak(history, [], NOW)).toBe(2)
  })

  it('is broken by a missed day', () => {
    const history = [sessionOn(at(10), 500), sessionOn(at(8), 500), sessionOn(at(7), 500)]
    expect(dayStreak(history, [], NOW)).toBe(1)
    expect(dayStreak([sessionOn(at(8), 500)], [], NOW)).toBe(0)
  })

  it('does not count a session that gained nothing', () => {
    expect(dayStreak([sessionOn(at(10), 0)], [], NOW)).toBe(0)
  })

  it('counts days the snapshots show a gain on, with or without a session', () => {
    const snapshots = [
      snapshot(at(7), 0),
      snapshot(at(8), 100),
      snapshot(at(9), 200),
      snapshot(at(10), 300),
    ]
    expect(dayStreak([], snapshots, NOW)).toBe(3)
    expect(dayStreak([sessionOn(at(7), 50)], snapshots, NOW)).toBe(4)
  })

  it('moves on at local midnight', () => {
    const history = [sessionOn(at(9, 23), 500)]
    expect(dayStreak(history, [], at(9, 23) + HOUR / 2)).toBe(1)
    expect(dayStreak(history, [], at(10, 0) + HOUR / 2)).toBe(1)
    expect(dayStreak(history, [], at(11, 0) + HOUR / 2)).toBe(0)
  })
})

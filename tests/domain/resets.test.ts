import { describe, expect, it } from 'vitest'
import type { Reset, ResetSchedule } from '#shared/types/reset'
import { RESETS } from '#shared/data/resets'
import { NO_REQUIREMENTS } from '#shared/domain/requirements'
import {
  describeLastDone,
  describeResetCadence,
  describeResetStatus,
  dueResets,
  resetAppliesTo,
  resetCadence,
  resetSkill,
  resetStatus,
  unlockedResets,
} from '#shared/domain/resets'
import { accountWith } from './helpers'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** 10 October 2026, 20:00 UTC. */
const NOW = Date.UTC(2026, 9, 10, 20)

function resetWith(schedule: ResetSchedule, overrides: Partial<Reset> = {}): Reset {
  return {
    key: 'test',
    name: 'Test reset',
    schedule,
    skill: null,
    requirements: NO_REQUIREMENTS,
    note: '',
    source: 'Test',
    audience: 'both',
    ...overrides,
  }
}

const everyEightyMinutes = resetWith({ kind: 'interval', minutes: 80 })
const daily = resetWith({ kind: 'utc-midnight' })
const weekly = resetWith({ kind: 'weekly' })
const treeRun = resetWith({
  kind: 'by-level',
  skill: 'farming',
  steps: [
    { fromLevel: 15, minutes: 200 },
    { fromLevel: 30, minutes: 240 },
    { fromLevel: 60, minutes: 400 },
  ],
})
const anyone = accountWith()

describe('resetAppliesTo', () => {
  it('keeps each account type to its own resets', () => {
    const forMains = resetWith({ kind: 'utc-midnight' }, { audience: 'main' })
    const forIronmen = resetWith({ kind: 'utc-midnight' }, { audience: 'iron' })
    const ironman = accountWith({ type: 'iron' })
    expect(resetAppliesTo(daily, anyone)).toBe(true)
    expect(resetAppliesTo(daily, ironman)).toBe(true)
    expect(resetAppliesTo(forMains, anyone)).toBe(true)
    expect(resetAppliesTo(forMains, ironman)).toBe(false)
    expect(resetAppliesTo(forIronmen, anyone)).toBe(false)
    expect(resetAppliesTo(forIronmen, ironman)).toBe(true)
  })
})

describe('resetCadence', () => {
  it('is the schedule itself when that is fixed', () => {
    expect(resetCadence(anyone, everyEightyMinutes)).toEqual({ kind: 'interval', minutes: 80 })
    expect(resetCadence(anyone, daily)).toEqual({ kind: 'utc-midnight' })
    expect(resetCadence(anyone, weekly)).toEqual({ kind: 'weekly' })
  })

  it('takes the highest step the skill level has reached', () => {
    const at = (level: number) => resetCadence(accountWith({ levels: { farming: level } }), treeRun)
    expect(at(15)).toEqual({ kind: 'interval', minutes: 200 })
    expect(at(29)).toEqual({ kind: 'interval', minutes: 200 })
    expect(at(30)).toEqual({ kind: 'interval', minutes: 240 })
    expect(at(99)).toEqual({ kind: 'interval', minutes: 400 })
  })

  it('takes the first step for a level below them all', () => {
    expect(resetCadence(anyone, treeRun)).toEqual({ kind: 'interval', minutes: 200 })
  })
})

describe('resetStatus', () => {
  it('is due when it has never been done', () => {
    expect(resetStatus(anyone, daily, undefined, NOW)).toEqual({ due: true, lastDoneAt: null })
    expect(resetStatus(anyone, everyEightyMinutes, 0, NOW)).toEqual({ due: true, lastDoneAt: null })
  })

  it('is due again once the interval has passed, to the minute', () => {
    const done = NOW - 80 * MINUTE
    expect(resetStatus(anyone, everyEightyMinutes, done, NOW)).toEqual({
      due: true,
      lastDoneAt: done,
    })
    expect(resetStatus(anyone, everyEightyMinutes, done + 1, NOW)).toEqual({
      due: false,
      readyInMilliseconds: 1,
    })
  })

  it('counts down the rest of an interval', () => {
    expect(resetStatus(anyone, everyEightyMinutes, NOW - 30 * MINUTE, NOW)).toEqual({
      due: false,
      readyInMilliseconds: 50 * MINUTE,
    })
  })

  it('waits seven days for a weekly', () => {
    expect(resetStatus(anyone, weekly, NOW - 6 * DAY, NOW)).toEqual({
      due: false,
      readyInMilliseconds: DAY,
    })
    expect(resetStatus(anyone, weekly, NOW - 7 * DAY, NOW).due).toBe(true)
  })

  it('makes a daily due when it was last done before midnight UTC', () => {
    const midnight = Date.UTC(2026, 9, 10)
    expect(resetStatus(anyone, daily, midnight - 1, NOW)).toEqual({
      due: true,
      lastDoneAt: midnight - 1,
    })
    // done a minute after midnight: not due until the next one, four hours from 20:00
    expect(resetStatus(anyone, daily, midnight + MINUTE, NOW)).toEqual({
      due: false,
      readyInMilliseconds: 4 * HOUR,
    })
  })

  it('uses the cadence the account’s level gives', () => {
    const done = NOW - 300 * MINUTE
    expect(resetStatus(accountWith({ levels: { farming: 30 } }), treeRun, done, NOW).due).toBe(true)
    expect(resetStatus(accountWith({ levels: { farming: 60 } }), treeRun, done, NOW).due).toBe(
      false,
    )
  })
})

describe('describeResetStatus', () => {
  it('says when a reset has never been done', () => {
    expect(describeResetStatus({ due: true, lastDoneAt: null }, NOW)).toBe('never done')
  })

  it('says how long ago a due reset was last done', () => {
    expect(describeResetStatus({ due: true, lastDoneAt: NOW - 3 * HOUR }, NOW)).toBe(
      'due, last 3 h ago',
    )
    expect(describeResetStatus({ due: true, lastDoneAt: NOW - 5 * DAY }, NOW)).toBe(
      'due, last 5 d ago',
    )
  })

  it('says how long until a reset is ready, rounded up', () => {
    expect(describeResetStatus({ due: false, readyInMilliseconds: 50 * MINUTE }, NOW)).toBe(
      'ready in 50 min',
    )
    expect(describeResetStatus({ due: false, readyInMilliseconds: 61 * MINUTE }, NOW)).toBe(
      'ready in 2 h',
    )
    expect(describeResetStatus({ due: false, readyInMilliseconds: 3 * DAY }, NOW)).toBe(
      'ready in 3 days',
    )
  })
})

describe('unlockedResets and dueResets', () => {
  it('offers a new account only the resets that need nothing', () => {
    const unlocked = unlockedResets(anyone)
    expect(unlocked.length).toBeGreaterThan(0)
    for (const reset of unlocked) {
      expect(reset.requirements).toEqual(NO_REQUIREMENTS)
    }
  })

  it('offers an ironman nothing that is closed to ironmen', () => {
    const ironman = accountWith({ type: 'iron', everySkill: 99, allQuests: true, allDiaries: true })
    const closed = RESETS.filter((reset) => reset.audience === 'main')
    expect(closed.length).toBeGreaterThan(0)
    for (const reset of closed) expect(unlockedResets(ironman)).not.toContain(reset)
  })

  it('offers everything for its account type to an account with every requirement met', () => {
    const veteran = accountWith({ everySkill: 99, allQuests: true, allDiaries: true })
    expect(unlockedResets(veteran)).toEqual(RESETS.filter((reset) => reset.audience !== 'iron'))
  })

  it('lists as due the unlocked resets that are due, in the data’s order', () => {
    const veteran = accountWith({ everySkill: 99, allQuests: true, allDiaries: true })
    const unlocked = unlockedResets(veteran)
    expect(dueResets(veteran, {}, NOW)).toEqual(unlocked)
    const [first, ...rest] = unlocked
    expect(dueResets(veteran, first ? { [first.key]: NOW - MINUTE } : {}, NOW)).toEqual(rest)
  })
})

describe('describeLastDone', () => {
  it('says when a due reset was last done, or that it never was', () => {
    expect(describeLastDone(null, NOW)).toBe('never done')
    expect(describeLastDone(NOW - 3 * HOUR, NOW)).toBe('last 3 h ago')
    expect(describeLastDone(NOW - 8 * DAY, NOW)).toBe('last 8 d ago')
  })
})

describe('describeResetCadence', () => {
  it('names the two fixed cadences', () => {
    expect(describeResetCadence({ kind: 'utc-midnight' })).toBe('Daily, 00:00 UTC')
    expect(describeResetCadence({ kind: 'weekly' })).toBe('Every 7 days')
  })

  it('gives a short interval in minutes', () => {
    expect(describeResetCadence({ kind: 'interval', minutes: 50 })).toBe('50 min')
    expect(describeResetCadence({ kind: 'interval', minutes: 119 })).toBe('119 min')
  })

  it('gives two hours to two days in hours, to one decimal place', () => {
    expect(describeResetCadence({ kind: 'interval', minutes: 120 })).toBe('2 h')
    expect(describeResetCadence({ kind: 'interval', minutes: 320 })).toBe('5.3 h')
    expect(describeResetCadence({ kind: 'interval', minutes: 960 })).toBe('16 h')
    expect(describeResetCadence({ kind: 'interval', minutes: 2879 })).toBe('48 h')
  })

  it('gives anything longer in days, to one decimal place', () => {
    expect(describeResetCadence({ kind: 'interval', minutes: 2880 })).toBe('2 days')
    expect(describeResetCadence({ kind: 'interval', minutes: 5120 })).toBe('3.6 days')
  })
})

describe('resetSkill', () => {
  it('is the skill the reset trains', () => {
    expect(resetSkill('birdhouse')).toBe('hunter')
    expect(resetSkill('herb')).toBe('farming')
  })

  it('is null for a reset that trains no skill and for a key no reset has', () => {
    const untrained = RESETS.find((reset) => reset.skill === null)
    expect(untrained).toBeDefined()
    expect(resetSkill(untrained?.key ?? '')).toBeNull()
    expect(resetSkill('a reset the data dropped')).toBeNull()
  })
})

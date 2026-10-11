import { describe, expect, it, vi } from 'vitest'
import type { Account } from '#shared/types/account'
import { SKILL_KEYS } from '#shared/data/skills'
import {
  FALLBACK_XP_PER_HOUR,
  dailyRunXpAt,
  daysLeft,
  hoursLeft,
  isRoughEstimate,
  maxProgress,
} from '#shared/domain/estimates'
import { MAX_XP, xpForLevel } from '#shared/domain/xp'
import { accountWith } from './helpers'

vi.mock('#shared/data/methods', () => import('./sample-methods'))

describe('hoursLeft', () => {
  it('takes each level at the best rate usable at that level', () => {
    // iron ore at 30k until Motherlode Mine opens at 30 for 35k
    const expected = xpForLevel(30) / 30_000 + (MAX_XP - xpForLevel(30)) / 35_000
    expect(hoursLeft(accountWith(), 'mining')).toBeCloseTo(expected, 8)
  })

  it('counts a method the account will unlock by level, but not one behind a quest it lacks', () => {
    const withQuest = accountWith({ quests: ['Bone Voyage'] })
    const expected =
      xpForLevel(30) / 30_000 +
      (xpForLevel(50) - xpForLevel(30)) / 35_000 +
      (MAX_XP - xpForLevel(50)) / 80_000
    expect(hoursLeft(withQuest, 'mining')).toBeCloseTo(expected, 8)
    expect(hoursLeft(withQuest, 'mining')).toBeLessThan(hoursLeft(accountWith(), 'mining'))
  })

  it('starts from the XP the account has', () => {
    const fresh = accountWith({ levels: { mining: 98 } })
    const nearly: Account = {
      ...fresh,
      skills: { ...fresh.skills, mining: { level: 98, xp: MAX_XP - 35_000 } },
    }
    expect(hoursLeft(nearly, 'mining')).toBeCloseTo(1, 10)
  })

  it('uses the fallback rate for levels where nothing usable has a rate', () => {
    expect(hoursLeft(accountWith(), 'slayer')).toBeCloseTo(MAX_XP / FALLBACK_XP_PER_HOUR, 8)
    const expected = xpForLevel(58) / FALLBACK_XP_PER_HOUR + (MAX_XP - xpForLevel(58)) / 60_000
    expect(hoursLeft(accountWith(), 'fishing')).toBeCloseTo(expected, 8)
  })

  it('is zero for a maxed skill and for a passive one', () => {
    expect(hoursLeft(accountWith({ levels: { mining: 99 } }), 'mining')).toBe(0)
    expect(hoursLeft(accountWith(), 'hitpoints')).toBe(0)
  })

  it('counts the time spent on runs for a skill trained by them', () => {
    // herb runs at 60k until tree runs open at 15 for 500k
    const expected = xpForLevel(15) / 60_000 + (MAX_XP - xpForLevel(15)) / 500_000
    expect(hoursLeft(accountWith(), 'farming')).toBeCloseTo(expected, 8)
  })
})

describe('isRoughEstimate', () => {
  it('is false when every level on the way has a rated method', () => {
    expect(isRoughEstimate(accountWith(), 'mining')).toBe(false)
  })

  it('is true when any level on the way leans on the fallback', () => {
    expect(isRoughEstimate(accountWith(), 'slayer')).toBe(true)
    expect(isRoughEstimate(accountWith(), 'fishing')).toBe(true)
  })

  it('stops being rough once the account is past the unrated levels', () => {
    expect(isRoughEstimate(accountWith({ levels: { fishing: 58 } }), 'fishing')).toBe(false)
  })

  it('is rough on a budget when the only method is expensive, though a block would still use it', () => {
    expect(isRoughEstimate(accountWith(), 'construction')).toBe(false)
    expect(isRoughEstimate(accountWith({ budget: 'cheap' }), 'construction')).toBe(true)
  })

  it('is never rough for a maxed or passive skill', () => {
    expect(isRoughEstimate(accountWith({ levels: { slayer: 99 } }), 'slayer')).toBe(false)
    expect(isRoughEstimate(accountWith(), 'hitpoints')).toBe(false)
  })
})

describe('dailyRunXpAt', () => {
  it('counts a run that comes round within a day once', () => {
    // herb runs: 2,000 XP every 80 minutes, done once a day
    expect(dailyRunXpAt(accountWith(), 'farming', 1)).toBe(2_000)
  })

  it('counts a run that takes longer than a day for its share of a day', () => {
    // tree runs: 6,000 XP every two days
    expect(dailyRunXpAt(accountWith(), 'farming', 15)).toBe(2_000 + 3_000)
  })

  it('grows a run’s XP with its rate bands', () => {
    expect(dailyRunXpAt(accountWith(), 'farming', 50)).toBe(4_000 + 3_000)
  })
})

describe('daysLeft', () => {
  it('walks the levels at the daily XP of the runs usable at each', () => {
    const expected =
      xpForLevel(15) / 2_000 +
      (xpForLevel(50) - xpForLevel(15)) / 5_000 +
      (MAX_XP - xpForLevel(50)) / 7_000
    expect(daysLeft(accountWith(), 'farming')).toBeCloseTo(expected, 6)
  })

  it('is zero for a skill that is not trained by runs, even if it has one', () => {
    expect(daysLeft(accountWith(), 'hunter')).toBe(0)
    expect(daysLeft(accountWith(), 'mining')).toBe(0)
  })

  it('is zero once the skill is maxed', () => {
    expect(daysLeft(accountWith({ levels: { farming: 99 } }), 'farming')).toBe(0)
  })
})

describe('maxProgress', () => {
  it('starts at nothing', () => {
    const progress = maxProgress(accountWith())
    expect(progress).toMatchObject({
      percent: 0,
      xp: 0,
      levelsLeft: 98 * 24,
      skillsMaxed: 0,
      skillCount: 24,
    })
  })

  it('adds up the hours of every skill that is not maxed', () => {
    const account = accountWith({ everySkill: 99, levels: { mining: 1, slayer: 1 } })
    const progress = maxProgress(account)
    expect(progress.hoursLeft).toBeCloseTo(
      hoursLeft(account, 'mining') + hoursLeft(account, 'slayer'),
      8,
    )
    expect(progress.skillsMaxed).toBe(22)
    expect(progress.levelsLeft).toBe(2 * 98)
  })

  it('ends at exactly 100%', () => {
    expect(maxProgress(accountWith({ everySkill: 99 }))).toEqual({
      percent: 100,
      xp: 24 * MAX_XP,
      levelsLeft: 0,
      hoursLeft: 0,
      skillsMaxed: 24,
      skillCount: SKILL_KEYS.length,
    })
  })

  it('does not count XP past 99', () => {
    const maxed = accountWith({ everySkill: 99 })
    const overshot: Account = {
      ...maxed,
      skills: { ...maxed.skills, thieving: { level: 99, xp: 200_000_000 } },
    }
    expect(maxProgress(overshot).percent).toBe(100)
    expect(maxProgress(overshot).xp).toBe(24 * MAX_XP)
  })
})

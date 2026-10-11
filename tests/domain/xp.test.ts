import { describe, expect, it } from 'vitest'
import {
  MAX_LEVEL,
  MAX_XP,
  levelForXp,
  stretchesToMax,
  xpForLevel,
  xpToMax,
  xpToNextLevel,
} from '#shared/domain/xp'

describe('xpForLevel', () => {
  it('matches the game’s table at the levels everyone knows', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(83)
    expect(xpForLevel(10)).toBe(1_154)
    expect(xpForLevel(50)).toBe(101_333)
    expect(xpForLevel(92)).toBe(6_517_253)
    expect(xpForLevel(99)).toBe(MAX_XP)
    expect(xpForLevel(126)).toBe(188_884_740)
  })

  it('puts 92 at half of 99, as the saying goes', () => {
    expect(xpForLevel(92) / xpForLevel(99)).toBeCloseTo(0.5, 3)
  })

  it('refuses a level outside the table', () => {
    expect(() => xpForLevel(0)).toThrow(RangeError)
    expect(() => xpForLevel(127)).toThrow(RangeError)
    expect(() => xpForLevel(-1)).toThrow(RangeError)
  })
})

describe('levelForXp', () => {
  it('turns XP into the level it has reached', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(82)).toBe(1)
    expect(levelForXp(83)).toBe(2)
    expect(levelForXp(MAX_XP - 1)).toBe(98)
    expect(levelForXp(MAX_XP)).toBe(99)
  })

  it('stops at 99 however much XP there is', () => {
    expect(levelForXp(200_000_000)).toBe(MAX_LEVEL)
  })

  it('agrees with xpForLevel at every level', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level)
    }
  })
})

describe('xpToNextLevel and xpToMax', () => {
  it('counts from the XP the skill has, not from the start of its level', () => {
    expect(xpToNextLevel({ level: 1, xp: 0 })).toBe(83)
    expect(xpToNextLevel({ level: 1, xp: 80 })).toBe(3)
    expect(xpToNextLevel({ level: 98, xp: MAX_XP - 10 })).toBe(10)
  })

  it('never goes below zero for a skill past 99', () => {
    expect(xpToMax({ level: 1, xp: 0 })).toBe(MAX_XP)
    expect(xpToMax({ level: 99, xp: MAX_XP })).toBe(0)
    expect(xpToMax({ level: 99, xp: 50_000_000 })).toBe(0)
  })
})

describe('stretchesToMax', () => {
  it('has one stretch for every level still to finish', () => {
    const stretches = stretchesToMax({ level: 90, xp: xpForLevel(90) + 1_000 })
    expect(stretches.map((stretch) => stretch.level)).toEqual([90, 91, 92, 93, 94, 95, 96, 97, 98])
  })

  it('starts the first stretch from the XP already gained', () => {
    const [first, second] = stretchesToMax({ level: 90, xp: xpForLevel(90) + 1_000 })
    expect(first?.xp).toBe(xpForLevel(91) - xpForLevel(90) - 1_000)
    expect(second?.xp).toBe(xpForLevel(92) - xpForLevel(91))
  })

  it('adds up to the XP left to 99', () => {
    const stat = { level: 37, xp: 30_000 }
    const total = stretchesToMax(stat).reduce((sum, stretch) => sum + stretch.xp, 0)
    expect(total).toBe(xpToMax(stat))
  })

  it('is empty for a maxed skill', () => {
    expect(stretchesToMax({ level: 99, xp: MAX_XP })).toEqual([])
  })
})

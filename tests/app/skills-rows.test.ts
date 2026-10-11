import { describe, expect, it } from 'vitest'
import type { Method } from '#shared/types/method'
import type { SkillKey } from '#shared/types/skill'
import { SKILL_KEYS } from '#shared/data/skills'
import type { SkillSort } from '#shared/domain/save'
import type { MethodOption } from '#shared/domain/methods'
import { MAX_XP } from '#shared/domain/xp'
import {
  skillBestNowText,
  skillRow,
  skillTimeLeftText,
  sortSkillInsights,
} from '~~/app/utils/skill-rows'
import { accountWith, methodWith } from '../domain/helpers'
import { fixtureAccount, fixturePace, insightFor, insightWith } from './skills-fixture'

/** A method the account can use, at 10,000 XP an hour. */
const openMethod = (changes: Partial<Method> = {}): MethodOption => ({
  method: methodWith(changes),
  xpPerHour: 10_000,
  xpPerRun: 0,
  missing: [],
  unlocked: true,
})

const account = fixtureAccount()
const fixtureInsights = SKILL_KEYS.map((skill) => insightFor(account, skill))
const fixtureRow = (skill: SkillKey) =>
  skillRow(insightFor(account, skill), fixturePace(skill), true)

describe('sortSkillInsights', () => {
  const order = (sort: SkillSort) =>
    sortSkillInsights(fixtureInsights, sort).map((insight) => insight.skill)

  it('puts the most work first and the finished skills last', () => {
    const skills = order('hours')
    // the order the fixture account's Skills table is in
    expect(skills.slice(0, 5)).toEqual(['slayer', 'agility', 'mining', 'sailing', 'runecraft'])
    expect(skills.slice(-3)).toEqual(['farming', 'hitpoints', 'thieving'])
  })

  it('keeps a finished skill last even when its hours say otherwise', () => {
    const maxed = insightWith({ skill: 'attack', stat: { level: 99, xp: MAX_XP }, hoursLeft: 500 })
    const passive = insightWith({ skill: 'hitpoints', hoursLeft: 0 })
    const sorted = sortSkillInsights([maxed, passive, insightWith()], 'hours')
    expect(sorted.map((insight) => insight.skill)).toEqual(['mining', 'hitpoints', 'attack'])
  })

  it('orders by level, lowest first, keeping the hiscores order within a level', () => {
    const skills = order('level')
    expect(skills.slice(0, 3)).toEqual(['sailing', 'prayer', 'construction'])
    expect(skills.at(-1)).toBe('thieving')
    // Hitpoints, Cooking and Agility are all 75: the hiscores list them in that order
    expect(skills.filter((skill) => account.skills[skill].level === 75)).toEqual([
      'hitpoints',
      'cooking',
      'agility',
    ])
  })

  it('orders by name', () => {
    const skills = order('name')
    expect(skills.slice(0, 3)).toEqual(['agility', 'attack', 'construction'])
    expect(skills.at(-1)).toBe('woodcutting')
  })

  it('leaves the list it was given as it was', () => {
    const before = fixtureInsights.map((insight) => insight.skill)
    sortSkillInsights(fixtureInsights, 'name')
    expect(fixtureInsights.map((insight) => insight.skill)).toEqual(before)
  })
})

describe('skillTimeLeftText', () => {
  it('gives the hours of a skill that is ground', () => {
    expect(skillTimeLeftText(insightWith({ hoursLeft: 124.6 }), false)).toBe('125 h')
    expect(skillTimeLeftText(insightWith({ hoursLeft: 2.5 }), false)).toBe('2.5 h')
    expect(skillTimeLeftText(insightWith({ hoursLeft: 0.5 }), false)).toBe('30 min')
  })

  it('says when the hours are rough', () => {
    expect(skillTimeLeftText(insightWith({ hoursLeft: 307, isRough: true }), true)).toBe(
      '307 h, rough',
    )
  })

  it('tells an ironman when the hours depend on their own supplies', () => {
    const supplied = insightWith({ fastestMethod: openMethod({ usesOwnSupplies: true }) })
    expect(skillTimeLeftText(supplied, true)).toBe('100 h, if supplied')
    expect(skillTimeLeftText(supplied, false)).toBe('100 h')
    expect(skillTimeLeftText(insightWith({ fastestMethod: openMethod() }), true)).toBe('100 h')
  })

  it('says rough before it says supplied', () => {
    const insight = insightWith({
      isRough: true,
      fastestMethod: openMethod({ usesOwnSupplies: true }),
    })
    expect(skillTimeLeftText(insight, true)).toBe('100 h, rough')
  })

  it('counts a skill trained by runs in days', () => {
    expect(skillTimeLeftText(insightWith({ skill: 'farming', daysLeft: 49.6 }), true)).toBe(
      '50 days of runs',
    )
  })

  it('gives no figure for a skill that comes with combat', () => {
    expect(skillTimeLeftText(insightWith({ skill: 'hitpoints', hoursLeft: 0 }), true)).toBe(
      'with combat',
    )
  })

  it('calls a skill at 99 maxed, whatever else is true of it', () => {
    const maxed = insightWith({ skill: 'hitpoints', stat: { level: 99, xp: MAX_XP } })
    expect(skillTimeLeftText(maxed, true)).toBe('maxed')
  })
})

describe('skillBestNowText', () => {
  it('names the fastest method open', () => {
    const insight = insightWith({ fastestMethod: openMethod({ name: 'Iron ore powermining' }) })
    expect(skillBestNowText(insight)).toBe('Iron ore powermining')
  })

  it('is empty when nothing is open, and for a skill at 99', () => {
    expect(skillBestNowText(insightWith())).toBe('')
    const maxed = insightWith({ stat: { level: 99, xp: MAX_XP }, fastestMethod: openMethod() })
    expect(skillBestNowText(maxed)).toBe('')
  })

  it('says what trains a skill that has no methods of its own', () => {
    expect(skillBestNowText(insightWith({ skill: 'hitpoints' }))).toBe('Trained by combat')
  })
})

describe('skillRow', () => {
  it('writes the rows for the fixture account', () => {
    expect(fixtureRow('woodcutting')).toMatchObject({
      name: 'Woodcutting',
      level: 74,
      isMaxed: false,
      pace: '+11k a day',
      toMax: '11.87M',
      timeLeft: '125 h',
      bestNow: 'Sulliusceps',
    })
    expect(fixtureRow('slayer')).toMatchObject({
      timeLeft: '307 h, rough',
      bestNow: 'Nieve or Steve',
    })
    expect(fixtureRow('ranged')).toMatchObject({
      timeLeft: '121 h, if supplied',
      bestNow: 'Gemstone Crab',
    })
    expect(fixtureRow('farming')).toMatchObject({
      timeLeft: '50 days of runs',
      bestNow: 'Hardwood tree runs',
    })
    expect(fixtureRow('hitpoints')).toMatchObject({
      toMax: '11.72M',
      timeLeft: 'with combat',
      bestNow: 'Trained by combat',
    })
    expect(fixtureRow('sailing')).toMatchObject({
      level: 1,
      pace: '',
      timeLeft: '161 h, rough',
      bestNow: '',
    })
  })

  it('shows the XP banked once a skill is 99', () => {
    expect(fixtureRow('thieving')).toMatchObject({
      isMaxed: true,
      toMax: '13.08M xp',
      timeLeft: 'maxed',
      bestNow: '',
    })
  })

  it('shows a pace only when XP has been gained', () => {
    const insight = insightFor(accountWith({ everySkill: 50 }), 'mining')
    expect(skillRow(insight, 0, false).pace).toBe('')
    expect(skillRow(insight, -40, false).pace).toBe('')
    expect(skillRow(insight, 778.4, false).pace).toBe('+778 a day')
    expect(skillRow(insight, 1_250_000, false).pace).toBe('+1.25M a day')
  })

  it('hands the strip the level of every method the account sees', () => {
    const insight = insightFor(account, 'woodcutting')
    expect(fixtureRow('woodcutting').methodLevels).toEqual(
      insight.methods.map((option) => option.method.level),
    )
    expect(fixtureRow('hitpoints').methodLevels).toEqual([])
  })
})

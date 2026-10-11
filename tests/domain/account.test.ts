import { describe, expect, it } from 'vitest'
import { SKILL_KEYS } from '#shared/data/skills'
import {
  blankAccount,
  combatLevel,
  hasCompletedDiary,
  hasCompletedQuest,
  isIronman,
} from '#shared/domain/account'
import { accountWith } from './helpers'

describe('blankAccount', () => {
  it('is a level 1 main with nothing ticked', () => {
    const account = blankAccount()
    expect(account.type).toBe('main')
    expect(Object.keys(account.skills)).toEqual([...SKILL_KEYS])
    expect(Object.values(account.skills).every((stat) => stat.level === 1 && stat.xp === 0)).toBe(
      true,
    )
    expect(account.completedQuests.size + account.completedDiaries.size).toBe(0)
    expect(account.preferences).toMatchObject({ budget: 'any', tickPerfect: false })
  })
})

describe('isIronman', () => {
  it('tells the account types apart', () => {
    expect(isIronman(accountWith({ type: 'iron' }))).toBe(true)
    expect(isIronman(accountWith({ type: 'main' }))).toBe(false)
  })
})

describe('hasCompletedQuest and hasCompletedDiary', () => {
  it('checks the names ticked', () => {
    const account = accountWith({ quests: ['Bone Voyage'], diaries: ['Ardougne Medium'] })
    expect(hasCompletedQuest(account, 'Bone Voyage')).toBe(true)
    expect(hasCompletedQuest(account, 'Dragon Slayer I')).toBe(false)
    expect(hasCompletedDiary(account, 'Ardougne Medium')).toBe(true)
    expect(hasCompletedDiary(account, 'Ardougne Hard')).toBe(false)
  })

  it('takes the cape shortcuts to mean everything', () => {
    expect(hasCompletedQuest(accountWith({ allQuests: true }), 'Anything at all')).toBe(true)
    expect(hasCompletedDiary(accountWith({ allDiaries: true }), 'Anywhere Elite')).toBe(true)
    expect(hasCompletedDiary(accountWith({ allQuests: true }), 'Ardougne Easy')).toBe(false)
  })
})

describe('combatLevel', () => {
  it('is 126 with every combat skill at 99', () => {
    expect(combatLevel(accountWith({ everySkill: 99 }))).toBe(126)
  })

  it('is 3 for a new character, who starts with 10 Hitpoints', () => {
    expect(combatLevel(accountWith({ levels: { hitpoints: 10 } }))).toBe(3)
  })

  it('takes the best of melee, ranged and magic, not their sum', () => {
    const base = { defence: 70, hitpoints: 70, prayer: 52 }
    const melee = combatLevel(accountWith({ levels: { ...base, attack: 70, strength: 70 } }))
    const ranger = combatLevel(accountWith({ levels: { ...base, ranged: 94 } }))
    const both = combatLevel(
      accountWith({ levels: { ...base, attack: 70, strength: 70, ranged: 94 } }),
    )
    expect(melee).toBe(87)
    expect(ranger).toBe(87)
    expect(both).toBe(87)
  })

  it('counts every second Prayer level', () => {
    const at = (prayer: number) => combatLevel(accountWith({ everySkill: 60, levels: { prayer } }))
    expect(at(61)).toBe(at(60))
    expect(at(68)).toBeGreaterThan(at(60))
  })
})

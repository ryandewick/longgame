import { describe, expect, it } from 'vitest'
import type { Account } from '#shared/types/account'
import type { SkillKey } from '#shared/types/skill'
import { combatLevel, withXp } from '#shared/domain/account'
import { combatPlan } from '#shared/domain/combat-plan'
import { hoursToLevel } from '#shared/domain/estimates'
import { xpForLevel } from '#shared/domain/xp'
import { walkGuide } from './guide-walk'
import { accountWith } from './helpers'

/** The account with the plan's levels reached. */
function trained(account: Account, levels: Partial<Record<SkillKey, number>>): Account {
  return Object.entries(levels).reduce(
    (raised, [skill, level]) =>
      withXp(raised, skill as SkillKey, xpForLevel(level) - raised.skills[skill as SkillKey].xp),
    account,
  )
}

describe('combatPlan', () => {
  it('needs nothing at the level already', () => {
    const account = accountWith({ everySkill: 60 })
    expect(combatPlan(account, combatLevel(account))).toEqual({ hours: 0, levels: {} })
  })

  it('reaches Dream Mentor’s 85 from where the main guide gets to it, raising only combat skills (decision 11, acceptance F10)', () => {
    const account = walkGuide('main').after(280)
    expect(combatLevel(account)).toBe(71)
    const plan = combatPlan(account, 85)
    expect(plan).not.toBeNull()
    expect(plan?.hours).toBeGreaterThan(0)
    const raised = Object.keys(plan?.levels ?? {})
    expect(
      raised.every((skill) =>
        ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer'].includes(skill),
      ),
    ).toBe(true)
    expect(combatLevel(trained(account, plan?.levels ?? {}))).toBeGreaterThanOrEqual(85)
  })

  it('costs no more than raising Defence alone, one way to the same level', () => {
    const account = accountWith({ everySkill: 50 })
    const target = combatLevel(account) + 5
    let defence = account.skills.defence.level
    while (combatLevel(trained(account, { defence })) < target) defence++
    const plan = combatPlan(account, target)
    expect(plan?.hours).toBeLessThanOrEqual(hoursToLevel(account, 'defence', defence) + 1e-9)
  })

  it('is null for a combat level no training reaches', () => {
    expect(combatPlan(accountWith({ everySkill: 99 }), 127)).toBeNull()
  })
})

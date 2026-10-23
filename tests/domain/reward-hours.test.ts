import { describe, expect, it } from 'vitest'
import type { QuestFacts } from '#shared/types/quest'
import type { SkillKey } from '#shared/types/skill'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import { QUESTS } from '#shared/data/quests'
import { SKILL_KEYS } from '#shared/data/skills'
import { hoursForXp } from '#shared/domain/estimates'
import { diaryRewardHours, questRewardHours } from '#shared/domain/reward-hours'
import { steeringLevels } from '#shared/domain/suggestions'
import { walkGuide } from './guide-walk'
import { accountWith, diaryFactsWith, freshAccount, questFactsWith } from './helpers'

const quest = (name: string): QuestFacts => {
  const found = QUEST_FACTS.find((facts) => facts.name === name)
  if (!found) throw new Error(`no quest ${name}`)
  return found
}

/** The skill a lamp's XP saves the most hours in, worked out the long way. */
function bestSkill(
  account: ReturnType<typeof accountWith>,
  xp: number,
  minLevel: number,
): SkillKey {
  let best: SkillKey = 'attack'
  let most = -1
  for (const skill of SKILL_KEYS) {
    if (account.skills[skill].level < minLevel) continue
    const hours = hoursForXp(account, skill, xp)
    if (hours > most) {
      most = hours
      best = skill
    }
  }
  return best
}

describe('questRewardHours', () => {
  it('values a quest’s fixed XP and the XP it pays during the quest at the account’s rates', () => {
    // Enlightened Journey: its fixed Crafting XP, and 8,000 Firemaking from the balloon flights
    const account = freshAccount()
    const fixed = QUESTS.find((each) => each.name === 'Enlightened Journey')?.fixedXp ?? {}
    const expected = SKILL_KEYS.reduce(
      (sum, skill) =>
        sum +
        hoursForXp(account, skill, (fixed[skill] ?? 0) + (skill === 'firemaking' ? 8_000 : 0)),
      0,
    )
    const reward = questRewardHours(account, [quest('Enlightened Journey')])
    expect(reward.hours).toBeCloseTo(expected, 8)
    expect(reward.placed).toEqual([])
  })

  it('puts a lamp where its XP saves the most hours (decision 3, acceptance F3)', () => {
    // Fairytale II's 2,500 xp lamp, for any skill at level 30 or above
    const account = accountWith({ everySkill: 30 })
    const reward = questRewardHours(account, [quest('Fairytale II - Cure a Queen')])
    expect(reward.placed).toEqual([
      { skill: bestSkill(account, 2_500, 30), xp: 2_500, reason: 'hours' },
    ])
  })

  it('places no lamp the account has no skill high enough for', () => {
    expect(questRewardHours(freshAccount(), [quest('Fairytale II - Cure a Queen')]).placed).toEqual(
      [],
    )
  })

  it('pays XP in order, so a second reward in a skill is valued where the first left it', () => {
    const facts = questFactsWith('Twice', {
      gives: {
        ...questFactsWith('').gives,
        xpChoices: [{ count: 2, xp: 50_000, skills: ['mining'], minLevel: 0 }],
      },
    })
    const account = freshAccount()
    const once = hoursForXp(account, 'mining', 50_000)
    const twice = questRewardHours(account, [facts]).hours
    expect(twice).toBeCloseTo(hoursForXp(account, 'mining', 100_000), 8)
    expect(twice).not.toBeCloseTo(2 * once, 3)
  })

  it('puts both Tourist Trap rewards on Agility for The Grand Tree, as the main guide does (acceptance A2, F3)', () => {
    // the main guide reaches The Tourist Trap at step 22 and The Grand Tree (25 Agility) at 41
    const account = walkGuide('main').after(21)
    expect(account.skills.agility.level).toBeLessThan(25)
    const steer = steeringLevels(account)
    expect(steer).toContainEqual({ skill: 'agility', level: 25 })
    expect(questRewardHours(account, [quest('The Tourist Trap')], steer).placed).toEqual([
      { skill: 'agility', xp: 4_650, reason: 'level' },
      { skill: 'agility', xp: 4_650, reason: 'level' },
    ])
    // with nothing to steer to, each goes where it saves the most hours
    const free = questRewardHours(account, [quest('The Tourist Trap')]).placed
    expect(free.every(({ reason }) => reason === 'hours')).toBe(true)
  })

  it('steers only where the reward reaches the level', () => {
    const account = freshAccount()
    const steer = [{ skill: 'agility' as const, level: 60 }]
    const placed = questRewardHours(account, [quest('The Tourist Trap')], steer).placed
    expect(placed.some(({ reason }) => reason === 'level')).toBe(false)
  })
})

describe('diaryRewardHours', () => {
  it('places a tier’s lamp as a quest’s is', () => {
    const account = accountWith({ everySkill: 70 })
    const diary = diaryFactsWith('Western Provinces Elite', { lamp: { xp: 50_000, minLevel: 70 } })
    const reward = diaryRewardHours(account, diary)
    const skill = bestSkill(account, 50_000, 70)
    expect(reward.placed).toEqual([{ skill, xp: 50_000, reason: 'hours' }])
    expect(reward.hours).toBeCloseTo(hoursForXp(account, skill, 50_000), 8)
  })
})

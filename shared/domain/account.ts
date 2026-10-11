import type { Account } from '../types/account'
import type { SkillKey } from '../types/skill'
import { forEverySkill } from '../data/skills'

/** An account that has not been looked up yet: level 1 everywhere, nothing ticked. */
export function blankAccount(): Account {
  return {
    type: 'main',
    skills: forEverySkill(() => ({ level: 1, xp: 0 })),
    completedQuests: new Set(),
    completedDiaries: new Set(),
    allQuests: false,
    allDiaries: false,
    preferences: { budget: 'any', tickPerfect: false, excludedSkills: new Set() },
  }
}

/** Is this an ironman, who cannot buy supplies? */
export function isIronman(account: Account): boolean {
  return account.type === 'iron'
}

/** Has the account finished this quest? */
export function hasCompletedQuest(account: Account, quest: string): boolean {
  return account.allQuests || account.completedQuests.has(quest)
}

/** Has the account finished this diary tier ('Ardougne Medium')? */
export function hasCompletedDiary(account: Account, diary: string): boolean {
  return account.allDiaries || account.completedDiaries.has(diary)
}

/** What is the account's combat level? The game's formula: a defensive base plus the best style. */
export function combatLevel(account: Account): number {
  const level = (skill: SkillKey) => account.skills[skill].level
  const base = 0.25 * (level('defence') + level('hitpoints') + Math.floor(level('prayer') / 2))
  const bestStyle = Math.max(
    0.325 * (level('attack') + level('strength')),
    0.325 * Math.floor(1.5 * level('ranged')),
    0.325 * Math.floor(1.5 * level('magic')),
  )
  return Math.floor(base + bestStyle)
}

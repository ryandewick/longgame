import type { Account } from '../types/account'
import type { SkillKey } from '../types/skill'
import { QUEST_FACTS } from '../data/quest-facts'
import { forEverySkill } from '../data/skills'

/** The quests every account has done: Learning the Ropes, which every player finishes to reach the mainland. */
const DONE_BY_EVERY_ACCOUNT: ReadonlySet<string> = new Set(
  QUEST_FACTS.filter((quest) => quest.doneByEveryAccount).map((quest) => quest.name),
)

/** Has every account done this quest, whatever is ticked? */
export function isDoneByEveryAccount(quest: string): boolean {
  return DONE_BY_EVERY_ACCOUNT.has(quest)
}

/** An account that has not been looked up yet: level 1 everywhere, nothing ticked. */
export function blankAccount(): Account {
  return {
    type: 'main',
    skills: forEverySkill(() => ({ level: 1, xp: 0 })),
    completedQuests: new Set(),
    startedQuests: new Set(),
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
  return account.allQuests || isDoneByEveryAccount(quest) || account.completedQuests.has(quest)
}

/** Has the account at least started this quest? A finished quest has been started. */
export function hasStartedQuest(account: Account, quest: string): boolean {
  return hasCompletedQuest(account, quest) || account.startedQuests.has(quest)
}

/** How far an account has got with a quest, as its tick box shows it. */
export type QuestProgressState = 'not-done' | 'started' | 'done'

/** How far the account has got with this quest. */
export function questProgress(account: Account, quest: string): QuestProgressState {
  if (hasCompletedQuest(account, quest)) return 'done'
  return account.startedQuests.has(quest) ? 'started' : 'not-done'
}

/**
 * The account's quest points: those of every quest it has finished. Recipe for Disaster's come
 * part by part, as the game gives them, so the umbrella entry gives none of its own.
 */
export function questPoints(account: Account): number {
  return QUEST_FACTS.reduce(
    (sum, quest) =>
      quest.gives.questPoints && hasCompletedQuest(account, quest.name)
        ? sum + quest.gives.questPoints
        : sum,
    0,
  )
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

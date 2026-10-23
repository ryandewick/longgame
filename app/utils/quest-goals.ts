import type { Account } from '#shared/types/account'
import { DIARY_FACTS } from '#shared/data/diary-facts'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import { skillName } from '#shared/data/skills'
import { hasCompletedDiary, questPoints } from '#shared/domain/account'
import type { GoalStanding } from '#shared/domain/goals'
import { formatMinutes } from './format'
import { listInWords } from './quest-questions'

/*
 * What the Quests page's Goals part says: the two capes and how far along each the account is,
 * and each goal's progress, the time left and what is left.
 */

/** How many goals "On the way" shows before it names the rest as further off. */
export const GOALS_ON_THE_WAY = 6

/** The quest point cape and the achievement diary cape: the account's count and the whole. */
export interface CapeCounts {
  readonly questPoints: number
  readonly questPointsTotal: number
  readonly tiers: number
  readonly tiersTotal: number
}

const QUEST_POINTS_TOTAL = QUEST_FACTS.reduce((sum, quest) => sum + quest.gives.questPoints, 0)

/** How far along the two capes the account is. */
export function capeCounts(account: Account): CapeCounts {
  return {
    questPoints: questPoints(account),
    questPointsTotal: QUEST_POINTS_TOTAL,
    tiers: DIARY_FACTS.filter((diary) => hasCompletedDiary(account, diary.name)).length,
    tiersTotal: DIARY_FACTS.length,
  }
}

/** A goal not done, as its row says it. */
export interface GoalRow {
  readonly id: string
  readonly name: string
  readonly gives: string
  /** Its quests and tiers done, of all of them: '6/7'. */
  readonly progress: string
  /** The same for a screen reader: '6 of 7 done'. */
  readonly progressLabel: string
  /** How much of the bar is filled, 0 to 100. */
  readonly share: number
  /** The time left, training included: '43 min', '2 h 30 min', '23 h'. */
  readonly timeLeft: string
  /** What is left to do: "Left: Start Fairytale II - Cure a Queen." Empty when only training is. */
  readonly left: string
  /** The levels it is short of: 'Short of 70 Prayer (52).' Empty for none. */
  readonly short: string
}

/** What is left of a goal, in words, the first few named and the rest counted. */
function leftWords(standing: GoalStanding): string {
  const items = [
    ...standing.steps.map(({ quest, state }) => (state === 'started' ? `Start ${quest}` : quest)),
    ...standing.diaries,
    ...(standing.questPointsShort ? [`${standing.questPointsShort} more quest points`] : []),
    ...(standing.combatShort ? [`combat level ${standing.combatShort.level}`] : []),
  ]
  return items.length ? `Left: ${listInWords(items, 4)}.` : ''
}

/** The rows of a list of goals, in the order given. */
export function goalRows(standings: readonly GoalStanding[]): GoalRow[] {
  return standings.map((standing) => {
    const short = standing.levelsShort.map(
      ({ skill, level, has }) => `${level} ${skillName(skill)} (${has})`,
    )
    return {
      id: standing.goal.id,
      name: standing.goal.name,
      gives: standing.goal.gives,
      progress: `${standing.doneCount}/${standing.total}`,
      progressLabel: `${standing.doneCount} of ${standing.total} done`,
      share: standing.total ? (100 * standing.doneCount) / standing.total : 0,
      timeLeft: formatMinutes(standing.hours * 60),
      left: leftWords(standing),
      short: short.length ? `Short of ${listInWords(short, 4)}.` : '',
    }
  })
}

/** The goals past the first few on the way, by name: 'Further off: A, B and C.' Empty for none. */
export function furtherOffLine(standings: readonly GoalStanding[]): string {
  const names = standings.slice(GOALS_ON_THE_WAY).map(({ goal }) => goal.name)
  return names.length ? `Further off: ${listInWords(names, names.length)}.` : ''
}

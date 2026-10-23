import type { Account } from '../types/account'
import type { DiaryFacts } from '../types/diary'
import type { Goal } from '../types/goal'
import type { LevelNeed, QuestFacts } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { DIARY_FACTS } from '../data/diary-facts'
import { GOALS } from '../data/goals'
import { QUEST_FACTS } from '../data/quest-facts'
import { SKILL_KEYS } from '../data/skills'
import {
  combatLevel,
  hasCompletedDiary,
  hasCompletedQuest,
  hasStartedQuest,
  isIronman,
  questPoints,
  withXp,
} from './account'
import { biggestBoost } from './boosts'
import { combatPlan } from './combat-plan'
import { hoursToLevel } from './estimates'
import { lowerTiers } from './quest-proof'
import { questPointsFill, stepsMinutes, stepsToDo, type QuestStep } from './quest-cost'
import { xpForLevel } from './xp'

/*
 * How far an account is from each goal, and what is left: the quests still to do, the tiers still
 * to claim, the levels and combat level it is short of after the boosts it may count, and the
 * time all of that takes. Training is counted at the account's own rates, combat levels the
 * cheapest way (decision 11), quest points made up by the quickest other quests.
 */

/** Goals with less than this left, in hours, are nearly there. */
export const NEARLY_THERE_HOURS = 2

/** A level a goal needs that the account lacks. */
export interface LevelShort extends LevelNeed {
  readonly has: number
  /** The level to train to: lower than `level` where a boost the account may count covers the rest. */
  readonly trainTo: number
}

/** Where an account stands with a goal. */
export interface GoalStanding {
  readonly goal: Goal
  readonly done: boolean
  /** Its quests as far as it needs them and its tiers claimed, of all of them. */
  readonly doneCount: number
  readonly total: number
  /** The quests still to do, in an order that works. */
  readonly steps: readonly QuestStep[]
  /** The tiers still to claim, lower tiers first. */
  readonly diaries: readonly string[]
  /** Levels short, after the boosts the account may count, in the game's skill order. */
  readonly levelsShort: readonly LevelShort[]
  /** The combat level it needs and the account lacks, or null. */
  readonly combatShort: { readonly level: number; readonly has: number } | null
  /** Quest points it needs beyond the account's and its own quests', or 0. */
  readonly questPointsShort: number
  /** Minutes of quests and tasks: its steps, its tiers, the quests that make up quest points. */
  readonly minutes: number
  /** Hours of training to the levels and the combat level it is short of. */
  readonly trainingHours: number
  /** All of it, in hours. */
  readonly hours: number
}

const QUESTS_BY_NAME: ReadonlyMap<string, QuestFacts> = new Map(
  QUEST_FACTS.map((quest) => [quest.name, quest]),
)
const DIARIES_BY_NAME: ReadonlyMap<string, DiaryFacts> = new Map(
  DIARY_FACTS.map((diary) => [diary.name, diary]),
)

/** The goals for this kind of account: the ironman guide's own milestone only for an ironman. */
export function goalsFor(account: Account): Goal[] {
  return GOALS.filter((goal) => !goal.ironmanOnly || isIronman(account))
}

/** The tiers a goal needs, every one when it needs them all, each with its lower tiers, in order. */
function tiersWanted(goal: Goal): string[] {
  const wanted = goal.allDiaries ? DIARY_FACTS.map((diary) => diary.name) : goal.diaries
  return [...new Set(wanted.flatMap((diary) => [...lowerTiers(diary), diary]))]
}

/** A level something needs, and whether a boost may count toward it. */
interface Need extends LevelNeed {
  readonly boostable: boolean
}

/** The levels its steps, its tiers and the goal itself need, with the ironman's own. */
function levelsNeeded(
  account: Account,
  goal: Goal,
  steps: readonly QuestStep[],
  diaries: readonly string[],
): Need[] {
  const needs: Need[] = goal.levels.map((need) => ({ ...need, boostable: false }))
  for (const { quest, state } of steps) {
    const facts = QUESTS_BY_NAME.get(quest)
    if (!facts) continue
    for (const skill of SKILL_KEYS) {
      const level = facts.levels[skill]
      if (level === undefined || facts.needs.bypassable.includes(skill)) continue
      if (state === 'started' && facts.needs.finishOnly.includes(skill)) continue
      needs.push({ skill, level, boostable: facts.needs.boostable.includes(skill) })
    }
    if (state === 'finished' && isIronman(account)) {
      for (const need of facts.needs.ironman) {
        if (need.condition !== null) continue
        // the option that takes the fewest hours to reach
        const cheapest = [...need.options].sort(
          (first, second) => optionHours(account, first) - optionHours(account, second),
        )[0]
        for (const level of cheapest ?? []) needs.push({ ...level, boostable: false })
      }
    }
  }
  for (const name of diaries) {
    const diary = DIARIES_BY_NAME.get(name)
    if (!diary) continue
    for (const skill of SKILL_KEYS) {
      const level = diary.levels[skill]
      if (level !== undefined)
        needs.push({ skill, level, boostable: diary.boostable.includes(skill) })
    }
    if (isIronman(account))
      for (const need of diary.ironman) needs.push({ ...need, boostable: false })
  }
  return needs
}

/** The hours to reach every level of an option. */
function optionHours(account: Account, option: readonly LevelNeed[]): number {
  return option.reduce((sum, { skill, level }) => sum + hoursToLevel(account, skill, level), 0)
}

/** The levels short, one a skill: the need that asks the most training, after boosts. */
function levelsShortOf(account: Account, needs: readonly Need[]): LevelShort[] {
  const bySkill = new Map<SkillKey, LevelShort>()
  for (const need of needs) {
    const boost = need.boostable ? biggestBoost(account, need.skill) : null
    const trainTo = need.level - (boost?.size ?? 0)
    const has = account.skills[need.skill].level
    const known = bySkill.get(need.skill)
    if (has < trainTo && (!known || trainTo > known.trainTo))
      bySkill.set(need.skill, { skill: need.skill, level: need.level, has, trainTo })
  }
  return SKILL_KEYS.flatMap((skill) => bySkill.get(skill) ?? [])
}

/** Where the account stands with a goal: what is done, what is left, and how long the rest takes. */
export function goalStanding(account: Account, goal: Goal): GoalStanding {
  const steps = stepsToDo(account, goal.quests)
  const tiers = tiersWanted(goal)
  const diaries = tiers.filter((diary) => !hasCompletedDiary(account, diary))
  const entries = Object.entries(goal.quests)
  const entriesDone = entries.filter(([quest, state]) =>
    state === 'finished' ? hasCompletedQuest(account, quest) : hasStartedQuest(account, quest),
  ).length

  const levelsShort = levelsShortOf(account, levelsNeeded(account, goal, steps, diaries))
  let trained = account
  let trainingHours = 0
  for (const short of levelsShort) {
    trainingHours += hoursToLevel(trained, short.skill, short.trainTo)
    const xp = xpForLevel(short.trainTo) - trained.skills[short.skill].xp
    trained = withXp(trained, short.skill, xp)
  }

  const finishing = steps.flatMap(({ quest, state }) => {
    const facts = state === 'finished' ? QUESTS_BY_NAME.get(quest) : undefined
    return facts ? [facts] : []
  })
  const tierFacts = diaries.flatMap((name) => DIARIES_BY_NAME.get(name) ?? [])
  const combatNeeded = Math.max(
    0,
    ...finishing.map((facts) => facts.needs.combat),
    ...tierFacts.map((diary) => diary.combat),
  )
  const combatHas = combatLevel(account)
  const combatShort = combatNeeded > combatHas ? { level: combatNeeded, has: combatHas } : null
  if (combatShort) trainingHours += combatPlan(trained, combatShort.level)?.hours ?? 0

  const pointsNeeded = Math.max(
    0,
    ...finishing.map((facts) => facts.needs.questPoints),
    ...tierFacts.map((diary) => diary.questPoints),
  )
  const pointsOnTheWay = finishing.reduce((sum, facts) => sum + facts.gives.questPoints, 0)
  const questPointsShort = Math.max(0, pointsNeeded - questPoints(account) - pointsOnTheWay)
  const fill = questPointsShort
    ? questPointsFill(account, new Set(steps.map(({ quest }) => quest)), questPointsShort)
    : { minutes: 0 }

  const minutes =
    stepsMinutes(account, steps) +
    tierFacts.reduce((sum, diary) => sum + diary.minutes.mid, 0) +
    fill.minutes
  const done = !steps.length && !diaries.length && !levelsShort.length && !combatShort
  return {
    goal,
    done,
    doneCount: entriesDone + tiers.length - diaries.length,
    total: entries.length + tiers.length,
    steps,
    diaries,
    levelsShort,
    combatShort,
    questPointsShort,
    minutes,
    trainingHours,
    hours: minutes / 60 + trainingHours,
  }
}

/** The account's goals in three groups: nearly there and on the way (nearest first), and done. */
export interface GoalGroups {
  readonly nearlyThere: readonly GoalStanding[]
  readonly onTheWay: readonly GoalStanding[]
  readonly done: readonly GoalStanding[]
}

/** Every goal for the account, grouped by how near it is: under two hours left is nearly there. */
export function goalGroups(account: Account): GoalGroups {
  const standings = goalsFor(account).map((goal) => goalStanding(account, goal))
  const open = standings
    .filter((standing) => !standing.done)
    .sort((first, second) => first.hours - second.hours)
  return {
    nearlyThere: open.filter((standing) => standing.hours < NEARLY_THERE_HOURS),
    onTheWay: open.filter((standing) => standing.hours >= NEARLY_THERE_HOURS),
    done: standings.filter((standing) => standing.done),
  }
}

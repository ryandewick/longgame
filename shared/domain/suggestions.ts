import type { Account } from '../types/account'
import type { DiaryFacts } from '../types/diary'
import type { Goal } from '../types/goal'
import type { LevelNeed, QuestFacts } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { DIARY_FACTS } from '../data/diary-facts'
import { QUEST_FACTS } from '../data/quest-facts'
import { SKILL_KEYS } from '../data/skills'
import { hasCompletedDiary, hasCompletedQuest, isIronman } from './account'
import { goalStanding, goalsFor, type GoalStanding } from './goals'
import {
  SMALLEST_SAVING_IN_HOURS,
  hoursLeftOf,
  requirementEffect,
  type RequirementEffect,
} from './plan-questions'
import { checkSteps, questMinutes, stepsMinutes, stepsToDo, type QuestStep } from './quest-cost'
import { diaryReadiness, questReadiness, type BoostedLevel, type Readiness } from './readiness'
import { diaryRewardHours, questRewardHours, type PlacedXp } from './reward-hours'

/*
 * What to do next (the Quests page's Next), in three lists, each suggestion with its reasons as
 * data:
 *
 * - Quests that save hours: every quest the account is ready for, with whatever has to come
 *   first, whose unlocks and XP take at least half an hour off the time to max, the most hours
 *   saved for the time it takes first.
 * - Unlocks that save no hours (decision 7): the account's goals in the order its own Optimal
 *   quest guide reaches them, each with the next thing it is ready to do towards it.
 * - Diary tiers it can claim (decision 6): those that open a method or reset saving at least half
 *   an hour first, then easy and medium tiers, then hard and elite ones the skill guides
 *   recommend, each group the quickest first.
 */

/** A quest worth doing for the hours it saves. */
export interface QuestSuggestion {
  readonly quest: QuestFacts
  /** The quests to do first, in order: the ones it requires that are not done, and ones to start. */
  readonly first: readonly QuestStep[]
  /** Hours off the time to max: what it and the quests before it open, and their XP. */
  readonly hoursSaved: number
  readonly unlockHours: number
  readonly rewardHours: number
  /** Where its XP with a choice of skill goes (decision 3). */
  readonly placed: readonly PlacedXp[]
  /** Minutes for all of it, the quests first included. */
  readonly minutes: number
  /** What it opens up, and the skills those train. */
  readonly effect: RequirementEffect
  /** The levels met only with a boost on the way. */
  readonly boosted: readonly BoostedLevel[]
}

/** A goal that saves no hours, with the next thing to do towards it. */
export interface UnlockSuggestion {
  readonly goal: Goal
  /** Where the account's own guide reaches the goal. */
  readonly step: number
  /** The next step towards it: one the account is ready for when there is one. */
  readonly next: QuestStep
  /** Whether the account is ready for that step, or what it needs. */
  readonly readiness: Readiness
  readonly minutes: number
  /** How far along it the account is, and what else it needs. */
  readonly standing: GoalStanding
}

/** A diary tier the account can claim now. */
export interface TierSuggestion {
  readonly diary: DiaryFacts
  /** Hours off the time to max from what its reward opens; what puts a tier first (decision 6). */
  readonly unlockHours: number
  /** The methods and resets its reward opens. */
  readonly opens: readonly string[]
  readonly minutes: number
  readonly boosted: readonly BoostedLevel[]
}

/** What to do next, in three lists. */
export interface Suggestions {
  readonly savingHours: readonly QuestSuggestion[]
  readonly unlocks: readonly UnlockSuggestion[]
  readonly tiers: readonly TierSuggestion[]
}

/** Plain code-point order, not a locale's: the order must come out the same on every machine. */
function byName(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0
}

/** Which of the account's two guides it follows. */
function guideOf(account: Account): 'main' | 'ironman' {
  return isIronman(account) ? 'ironman' : 'main'
}

/** Where the account's guide does a quest (its start for a quest to start), or Infinity. */
function guideStep(account: Account, step: QuestStep): number {
  const place = QUEST_FACTS.find((quest) => quest.name === step.quest)?.guide[guideOf(account)]
  const at = step.state === 'started' ? (place?.start ?? place?.finish) : place?.finish
  return at ?? Number.POSITIVE_INFINITY
}

/**
 * The levels the planner is steering towards: what stops the next step of each of the first few
 * goals in the account's guide. Rewards with a choice of skill go there first (decision 3), as
 * the main guide puts both Tourist Trap rewards on Agility for The Grand Tree.
 */
export function steeringLevels(account: Account, goals = 5): LevelNeed[] {
  const levels: LevelNeed[] = []
  for (const standing of openGoalsInGuideOrder(account).slice(0, goals)) {
    const blocked = checkSteps(account, standing.standing.steps).blocked
    for (const gap of blocked?.readiness.missing ?? []) {
      if (gap.kind === 'skill') levels.push({ skill: gap.skill, level: gap.level })
    }
  }
  return levels
}

/** The account's goals not done that its guide reaches, in the guide's order. */
function openGoalsInGuideOrder(
  account: Account,
): { readonly standing: GoalStanding; readonly step: number }[] {
  const guide = guideOf(account)
  return goalsFor(account)
    .flatMap((goal) => {
      const step = goal.guide[guide]
      if (step === null) return []
      const standing = goalStanding(account, goal)
      return standing.done ? [] : [{ standing, step }]
    })
    .sort((first, second) => first.step - second.step)
}

/** Every quest worth doing for the hours it saves, the most saved for its time first. */
function questsSavingHours(account: Account): QuestSuggestion[] {
  const hoursNow = hoursLeftOf(account)
  const steer = steeringLevels(account)
  const found: { readonly suggestion: QuestSuggestion; readonly perHour: number }[] = []
  for (const quest of QUEST_FACTS) {
    // an entry the data does not time cannot be weighed against the time it saves
    if (
      hasCompletedQuest(account, quest.name) ||
      (!quest.time.minutes && quest.kind === 'activity')
    )
      continue
    const steps = stepsToDo(account, { [quest.name]: 'finished' })
    const check = checkSteps(account, steps)
    if (check.blocked) continue
    const effect = requirementEffect(account, { kind: 'quest', name: quest.name }, hoursNow)
    const finishing = steps.flatMap(({ quest: name, state }) => {
      const facts =
        state === 'finished' ? QUEST_FACTS.find((each) => each.name === name) : undefined
      return facts ? [facts] : []
    })
    const reward = questRewardHours(account, finishing, steer)
    const hoursSaved = effect.hoursSaved + reward.hours
    const minutes = stepsMinutes(account, steps)
    if (hoursSaved < SMALLEST_SAVING_IN_HOURS || !minutes) continue
    found.push({
      perHour: hoursSaved / (minutes / 60),
      suggestion: {
        quest,
        first: steps.filter((step) => step.quest !== quest.name),
        hoursSaved,
        unlockHours: effect.hoursSaved,
        rewardHours: reward.hours,
        placed: reward.placed,
        minutes,
        effect,
        boosted: check.boosted,
      },
    })
  }
  // A quest whose saving is mostly a quest's it requires (Dream Mentor's, Lunar Diplomacy's) says
  // nothing that one does not: it is left out until that one is done, as a question is asked
  // after the one that carries its saving (plan-questions' askCarriersFirst).
  const saving = new Map(
    found.map(({ suggestion }) => [suggestion.quest.name, suggestion.hoursSaved]),
  )
  const carried = ({ suggestion }: (typeof found)[number]): boolean =>
    suggestion.first.some(({ quest }) => (saving.get(quest) ?? 0) >= suggestion.hoursSaved / 2)
  return found
    .filter((entry) => !carried(entry))
    .sort(
      (first, second) =>
        second.perHour - first.perHour ||
        second.suggestion.hoursSaved - first.suggestion.hoursSaved ||
        byName(first.suggestion.quest.name, second.suggestion.quest.name),
    )
    .map(({ suggestion }) => suggestion)
}

/**
 * The account's goals in its guide's order (decision 7), each with the next step towards it: of
 * the steps the account is ready for, the first its guide does; when it is ready for none, the
 * first its guide does, with what that needs. A goal with no quest left (training or tiers only)
 * is left to the goals list.
 */
function unlocksInGuideOrder(account: Account): UnlockSuggestion[] {
  const unlocks: UnlockSuggestion[] = []
  for (const { standing, step } of openGoalsInGuideOrder(account)) {
    const options = standing.steps.flatMap((each) => {
      const facts = QUEST_FACTS.find((quest) => quest.name === each.quest)
      if (!facts) return []
      const readiness = questReadiness(account, facts, each.state === 'started')
      return [{ step: each, facts, readiness, ready: !readiness.missing.length }]
    })
    const next = options.sort(
      (first, second) =>
        Number(second.ready) - Number(first.ready) ||
        guideStep(account, first.step) - guideStep(account, second.step),
    )[0]
    if (!next) continue
    unlocks.push({
      goal: standing.goal,
      step,
      next: next.step,
      readiness: next.readiness,
      minutes: questMinutes(account, next.facts),
      standing,
    })
  }
  return unlocks
}

/** Decision 6's groups: tiers that save hours, then easy and medium ones, then hard and elite. */
function tierGroup(tier: TierSuggestion): number {
  if (tier.unlockHours >= SMALLEST_SAVING_IN_HOURS) return 0
  return tier.diary.tier === 'Easy' || tier.diary.tier === 'Medium' ? 1 : 2
}

/**
 * The diary tiers the account can claim now, in decision 6's order: those whose reward opens a
 * method or a reset saving at least half an hour (the most hours first), then easy and medium
 * tiers, then hard and elite ones with the tiers the skill guides recommend first, each group
 * the quickest first. A tier needs its lower tiers claimed to be ready, so none comes before them.
 */
function tiersToClaim(account: Account): TierSuggestion[] {
  const hoursNow = hoursLeftOf(account)
  const tiers: TierSuggestion[] = []
  for (const diary of DIARY_FACTS) {
    if (hasCompletedDiary(account, diary.name)) continue
    const readiness = diaryReadiness(account, diary)
    if (readiness.missing.length) continue
    const effect = requirementEffect(account, { kind: 'diary', name: diary.name }, hoursNow)
    tiers.push({
      diary,
      unlockHours: effect.hoursSaved,
      opens: effect.opens,
      minutes: diary.minutes.mid,
      boosted: readiness.boosted,
    })
  }
  return tiers.sort(
    (first, second) =>
      tierGroup(first) - tierGroup(second) ||
      (tierGroup(first) === 0 ? second.unlockHours - first.unlockHours : 0) ||
      (tierGroup(first) === 2
        ? Number(second.diary.recommended) - Number(first.diary.recommended)
        : 0) ||
      first.minutes - second.minutes ||
      byName(first.diary.name, second.diary.name),
  )
}

/** What the account could do next, in the three lists of the Quests page's Next. */
export function suggestions(account: Account): Suggestions {
  return {
    savingHours: questsSavingHours(account),
    unlocks: unlocksInGuideOrder(account),
    tiers: tiersToClaim(account),
  }
}

/** The hours a diary tier's lamp saves, placed as decision 3 says: for the tier list's figures. */
export function tierLampHours(account: Account, diary: DiaryFacts): number {
  return diaryRewardHours(account, diary, steeringLevels(account)).hours
}

/** The skills a quest suggestion's openings train, in hiscores order. */
export function skillsOpened(suggestion: QuestSuggestion): SkillKey[] {
  const trained = new Set(suggestion.effect.methodsOpened.flatMap((method) => method.skills))
  return SKILL_KEYS.filter((skill) => trained.has(skill))
}

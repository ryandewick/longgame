import type { Account } from '../types/account'
import type { ChoiceItem, DiaryFacts, NeedChoice } from '../types/diary'
import type { LevelNeed, QuestFacts, QuestState } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { QUEST_FACTS } from '../data/quest-facts'
import { SKILL_KEYS } from '../data/skills'
import {
  combatLevel,
  hasCompletedDiary,
  hasCompletedQuest,
  hasStartedQuest,
  isIronman,
  questPoints,
} from './account'
import { biggestBoost, nearestBoost, type BoostWithin, type SizedBoost } from './boosts'
import { kudosWithinReach } from './kudos'
import { lowerTiers } from './quest-proof'

/*
 * Readiness: what a quest or a diary tier still needs of an account, as typed gaps, and the boosts
 * it counts on. Ready means no gaps; ready with boosts means no gaps and some levels met only with
 * a boost (decision 1). Only what the data can check is a gap. What it cannot (an item, access to
 * an altar, a count to build up) never stands in the way: the tier's facts carry it, for words
 * beside the readiness.
 */

/** A level the account meets only with a boost, and the boost. */
export interface BoostedLevel extends LevelNeed {
  readonly has: number
  readonly boost: SizedBoost
}

/** One thing standing between an account and a quest or a diary tier. */
export type ReadinessGap =
  /** A lower tier of the same diary, whose reward must be claimed first. */
  | { readonly kind: 'lower-tier'; readonly diary: string }
  /** A quest to finish, or at least to start. */
  | { readonly kind: 'quest'; readonly quest: string; readonly state: QuestState }
  | {
      readonly kind: 'skill'
      readonly skill: SkillKey
      readonly level: number
      readonly has: number
      readonly boostable: boolean
      /** For a boostable level no counted boost covers: the boost that would with the fewest levels to train first. */
      readonly nearestBoost: BoostWithin | null
      /** A lower Runecraft level that is enough with Raiments of the Eye pieces (decision 5), shown and never counted. */
      readonly raiments: { readonly level: number; readonly pieces: number } | null
    }
  | { readonly kind: 'quest-points'; readonly needed: number; readonly has: number }
  | { readonly kind: 'combat'; readonly level: number; readonly has: number }
  /** More Kudos than the account's quests and the museum's quiz and finds give (approval 6). */
  | { readonly kind: 'kudos'; readonly needed: number; readonly withinReach: number }
  /** An either-or need none of whose options the account meets. */
  | { readonly kind: 'choice'; readonly choice: NeedChoice }
  /** Every quest (Lumbridge & Draynor Elite's quest point cape), and how many are left. */
  | { readonly kind: 'all-quests'; readonly left: number }
  /** Levels an ironman needs to make something: one of the options. `need` names what, when known. */
  | {
      readonly kind: 'ironman'
      readonly need: string | null
      readonly options: readonly (readonly LevelNeed[])[]
    }

/** What a quest or tier still needs, and the boosts it counts on. */
export interface Readiness {
  /**
   * What is missing, empty when ready. Always in this order: lower tiers, quests, levels in the
   * game's skill order, quest points, combat, Kudos, choices, every quest, an ironman's levels.
   */
  readonly missing: readonly ReadinessGap[]
  /** The levels met only with a boost: 'ready with a super fishing potion'. */
  readonly boosted: readonly BoostedLevel[]
}

/** The quests the quest point cape needs, which is what 'every quest' means. */
const CAPE_QUESTS: readonly string[] = QUEST_FACTS.filter((quest) => quest.kind === 'quest').map(
  (quest) => quest.name,
)

/** Has the account got this quest as far as the state says (a finished quest counts as started)? */
function questAt(account: Account, quest: string, state: QuestState): boolean {
  return state === 'finished' ? hasCompletedQuest(account, quest) : hasStartedQuest(account, quest)
}

/** Checks one level: met, met with a boost (noted in `boosted`), or a gap (noted in `missing`). */
function checkLevel(
  account: Account,
  need: LevelNeed,
  boostable: boolean,
  found: { missing: ReadinessGap[]; boosted: BoostedLevel[] },
  raiments: { readonly level: number; readonly pieces: number } | null = null,
): void {
  const has = account.skills[need.skill].level
  if (has >= need.level) return
  const boost = boostable ? biggestBoost(account, need.skill) : null
  if (boost && has + boost.size >= need.level) {
    found.boosted.push({ ...need, has, boost })
    return
  }
  found.missing.push({
    kind: 'skill',
    ...need,
    has,
    boostable,
    nearestBoost: boostable ? nearestBoost(account, need) : null,
    raiments,
  })
}

/** The quest points, combat level and Kudos the account lacks of what a quest or tier needs. */
function countGaps(
  account: Account,
  needs: { readonly questPoints: number; readonly combat: number; readonly kudos: number },
): ReadinessGap[] {
  const gaps: ReadinessGap[] = []
  if (needs.questPoints) {
    const has = questPoints(account)
    if (has < needs.questPoints) gaps.push({ kind: 'quest-points', needed: needs.questPoints, has })
  }
  if (needs.combat) {
    const has = combatLevel(account)
    if (has < needs.combat) gaps.push({ kind: 'combat', level: needs.combat, has })
  }
  if (needs.kudos) {
    const withinReach = kudosWithinReach(account)
    if (withinReach < needs.kudos) gaps.push({ kind: 'kudos', needed: needs.kudos, withinReach })
  }
  return gaps
}

/** Does the account have every level of the set? */
function hasLevels(account: Account, levels: readonly LevelNeed[]): boolean {
  return levels.every(({ skill, level }) => account.skills[skill].level >= level)
}

/**
 * The boosts an option of a choice counts on when the account meets it, or null when it does not.
 * Something the app cannot check counts as met: it never stands in the way.
 */
function meetOption(account: Account, option: readonly ChoiceItem[]): BoostedLevel[] | null {
  const boosted: BoostedLevel[] = []
  for (const item of option) {
    if (item.kind === 'skill') {
      const has = account.skills[item.skill].level
      if (has >= item.level) continue
      const boost = item.boostable ? biggestBoost(account, item.skill) : null
      if (!boost || has + boost.size < item.level) return null
      boosted.push({ skill: item.skill, level: item.level, has, boost })
    } else if (item.kind === 'quest') {
      if (!questAt(account, item.quest, item.state)) return null
    } else if (item.kind === 'combat') {
      if (combatLevel(account) < item.level) return null
    }
  }
  return boosted
}

/** The boosts the best met option counts on (the fewest), or null when no option is met. */
function meetChoice(account: Account, choice: NeedChoice): BoostedLevel[] | null {
  let best: BoostedLevel[] | null = null
  for (const option of choice.options) {
    const boosts = meetOption(account, option)
    if (boosts && (!best || boosts.length < best.length)) best = boosts
  }
  return best
}

/**
 * What the account still needs to do a quest, or with `toStart` only to start it: then the levels
 * its page needs only to finish it, and an ironman's levels for what it has to make, do not count.
 * A level the page says can be got round never stands in the way, and nor does an ironman's need
 * that applies only sometimes (acceptance B3).
 */
export function questReadiness(account: Account, quest: QuestFacts, toStart = false): Readiness {
  const found = { missing: [] as ReadinessGap[], boosted: [] as BoostedLevel[] }
  for (const name of quest.requires) {
    if (!hasCompletedQuest(account, name))
      found.missing.push({ kind: 'quest', quest: name, state: 'finished' })
  }
  for (const name of quest.requiresStarted) {
    if (!hasStartedQuest(account, name))
      found.missing.push({ kind: 'quest', quest: name, state: 'started' })
  }
  for (const skill of SKILL_KEYS) {
    const level = quest.levels[skill]
    if (level === undefined || quest.needs.bypassable.includes(skill)) continue
    if (toStart && quest.needs.finishOnly.includes(skill)) continue
    checkLevel(account, { skill, level }, quest.needs.boostable.includes(skill), found)
  }
  found.missing.push(...countGaps(account, quest.needs))
  if (isIronman(account) && !toStart) {
    for (const need of quest.needs.ironman) {
      if (need.condition !== null) continue
      if (!need.options.some((option) => hasLevels(account, option)))
        found.missing.push({ kind: 'ironman', need: need.need, options: need.options })
    }
  }
  return found
}

/**
 * What the account still needs to claim a diary tier's reward: every lower tier first, then what
 * its tasks need. A quest its page reads as only started but that the tier is planned on finished
 * (decision 4) is asked for finished. An either-or need is met by any one option.
 */
export function diaryReadiness(account: Account, diary: DiaryFacts): Readiness {
  const found = { missing: [] as ReadinessGap[], boosted: [] as BoostedLevel[] }
  for (const lower of lowerTiers(diary.name)) {
    if (!hasCompletedDiary(account, lower)) found.missing.push({ kind: 'lower-tier', diary: lower })
  }
  for (const [quest, read] of Object.entries(diary.quests)) {
    const state: QuestState = diary.planFinished.includes(quest) ? 'finished' : read
    if (!questAt(account, quest, state)) found.missing.push({ kind: 'quest', quest, state })
  }
  for (const skill of SKILL_KEYS) {
    const level = diary.levels[skill]
    if (level === undefined) continue
    const raiments = skill === 'runecraft' ? diary.raiments : null
    checkLevel(account, { skill, level }, diary.boostable.includes(skill), found, raiments)
  }
  found.missing.push(...countGaps(account, diary))
  for (const choice of diary.choices) {
    const boosts = meetChoice(account, choice)
    if (boosts) found.boosted.push(...boosts)
    else found.missing.push({ kind: 'choice', choice })
  }
  if (diary.allQuests) {
    const left = CAPE_QUESTS.filter((quest) => !hasCompletedQuest(account, quest)).length
    if (left) found.missing.push({ kind: 'all-quests', left })
  }
  if (isIronman(account)) {
    for (const need of diary.ironman) {
      if (!hasLevels(account, [need]))
        found.missing.push({ kind: 'ironman', need: null, options: [[need]] })
    }
  }
  return found
}

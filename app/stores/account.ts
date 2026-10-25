import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type { Account, AccountType } from '#shared/types/account'
import type { QuestState } from '#shared/types/quest'
import type { SkillKey, SkillStat } from '#shared/types/skill'
import { forEverySkill, SKILL_KEYS } from '#shared/data/skills'
import { hasCompletedDiary, questProgress, type QuestProgressState } from '#shared/domain/account'
import { rackOrder as rackOrderOf } from '#shared/domain/capes'
import {
  daysLeft,
  hoursLeft,
  isRoughEstimate,
  maxProgress as maxProgressOf,
  type MaxProgress,
} from '#shared/domain/estimates'
import { fastestMethod, methodOptions, nextUnlock, type MethodOption } from '#shared/domain/methods'
import {
  planQuestions as planQuestionsFor,
  type PlanQuestions,
  type PlanRequirement,
} from '#shared/domain/plan-questions'
import { startedMatters } from '#shared/domain/quest-proof'
import {
  closeTicks,
  declineDiary,
  declineQuest,
  startQuest,
  tickAll,
  tickDiary,
  tickQuest,
  untickDiary,
  untickQuest,
  type QuestTickChange,
  type QuestTicks,
  type ReportedProgress,
} from '#shared/domain/quest-ticks'
import type { ResetLog } from '#shared/domain/resets'
import {
  accountFromSave,
  blankSave,
  type SavedHiscores,
  type SavedPreferences,
  type SavedState,
} from '#shared/domain/save'

/** The part of the save this store keeps. */
export type SavedAccount = Pick<
  SavedState,
  | 'name'
  | 'accountType'
  | 'hiscores'
  | 'completedQuests'
  | 'startedQuests'
  | 'completedDiaries'
  | 'declinedQuests'
  | 'declinedDiaries'
  | 'allQuests'
  | 'allDiaries'
  | 'preferences'
  | 'resetLog'
>

/** Everything the screens show about one skill, worked out once each time the account changes. */
export interface SkillInsight {
  readonly skill: SkillKey
  readonly stat: SkillStat
  /** Every method of the skill as this account sees it, in the data's order. */
  readonly methods: readonly MethodOption[]
  /** Hours of grinding to 99 at the best methods open at each level; 0 once maxed. */
  readonly hoursLeft: number
  /** Days of timed runs to 99, for a skill trained by them (Farming); otherwise 0. */
  readonly daysLeft: number
  /** The hours figure leans on a stand-in rate somewhere, because the wiki gives none. */
  readonly isRough: boolean
  /** What the skill and method lists call best now. Null for a passive skill. */
  readonly fastestMethod: MethodOption | null
  /** The next rated method the account will unlock. Null when everything is open. */
  readonly nextUnlock: MethodOption | null
}

/** What a press of a quest's tick box did: where the quest is now, and what else moved. */
export interface QuestStep extends Omit<QuestTickChange, 'ticks'> {
  /** Where the quest was before the press. */
  readonly from: QuestProgressState
  /** Where the quest is now. */
  readonly to: QuestProgressState
}

/** What a press of a diary tier's tick box did: whether it is ticked now, and what else moved. */
export interface DiaryStep extends Omit<QuestTickChange, 'ticks'> {
  readonly ticked: boolean
}

/** A step that moved nothing else. */
const MOVED_NOTHING: Omit<QuestTickChange, 'ticks'> = {
  alsoChanged: [],
  alsoStarted: [],
  diariesChanged: [],
  heldStartedBy: [],
}

/** What a tick change moved besides its own quest or tier: the change without its ticks. */
function movedBy(change: QuestTickChange): Omit<QuestTickChange, 'ticks'> {
  return {
    alsoChanged: change.alsoChanged,
    alsoStarted: change.alsoStarted,
    diariesChanged: change.diariesChanged,
    heldStartedBy: change.heldStartedBy,
  }
}

/** The list with the item in it, or without it. */
function withItem<Item>(list: readonly Item[], item: Item, present: boolean): readonly Item[] {
  const without = list.filter((other) => other !== item)
  return present ? [...without, item] : without
}

/**
 * The player: who they are, what the hiscores say, what they have ticked by hand and how they
 * like to play. Everything the rules decide about them is a getter here, built on shared/domain.
 */
export const useAccountStore = defineStore('account', () => {
  const blank = blankSave()

  /** The player's name on the hiscores; empty until they give one. */
  const name = shallowRef(blank.name)
  /** Null until the lookup has said whether the account is an ironman. */
  const accountType = shallowRef<AccountType | null>(blank.accountType)
  /** The hiscores as last fetched; null until the first fetch. */
  const hiscores = shallowRef<SavedHiscores | null>(blank.hiscores)
  /** Quests ticked done, by name, with what the ticks prove written in (shared/domain/quest-ticks.ts). */
  const completedQuests = shallowRef<readonly string[]>(blank.completedQuests)
  /** Quests started and not finished, only ever ones whose start matters to something. */
  const startedQuests = shallowRef<readonly string[]>(blank.startedQuests)
  /** Diary tiers ticked done: 'Ardougne Medium'. */
  const completedDiaries = shallowRef<readonly string[]>(blank.completedDiaries)
  /** Quests the player answered "Not yet" for, so they are not asked about again. */
  const declinedQuests = shallowRef<readonly string[]>(blank.declinedQuests)
  /** Diary tiers the player answered "Not yet" for. */
  const declinedDiaries = shallowRef<readonly string[]>(blank.declinedDiaries)
  /** The quest cape shortcut: every quest counts as done. */
  const allQuests = shallowRef(blank.allQuests)
  /** The diary cape shortcut: every diary counts as done. */
  const allDiaries = shallowRef(blank.allDiaries)
  const preferences = shallowRef<SavedPreferences>(blank.preferences)
  /** When each reset was last done, by reset key. */
  const resetLog = shallowRef<ResetLog>(blank.resetLog)

  /** There is an account to plan for: a name and its stats. Until then the setup screen shows. */
  const hasAccount = computed(() => name.value !== '' && hiscores.value !== null)
  const isIronman = computed(() => accountType.value === 'iron')

  // The three preferences the rules read, taken out one by one so that changing any other
  // preference (tonight's mood, the sort order) does not work every estimate out again.
  const budget = computed(() => preferences.value.budget)
  const tickPerfect = computed(() => preferences.value.tickPerfect)
  const excludedSkills = computed(() => preferences.value.excludedSkills)

  /** The account as the rules in shared/domain see it. */
  const account = computed<Account>(() =>
    accountFromSave({
      ...blank,
      accountType: accountType.value,
      hiscores: hiscores.value,
      completedQuests: completedQuests.value,
      startedQuests: startedQuests.value,
      completedDiaries: completedDiaries.value,
      allQuests: allQuests.value,
      allDiaries: allDiaries.value,
      preferences: {
        ...blank.preferences,
        budget: budget.value,
        tickPerfect: tickPerfect.value,
        excludedSkills: excludedSkills.value,
      },
    }),
  )

  /** Every skill's insight. The estimates walk each skill level by level, so they are worked out here once. */
  const skillInsights = computed<Readonly<Record<SkillKey, SkillInsight>>>(() =>
    forEverySkill((skill) => {
      const methods = methodOptions(account.value, skill)
      return {
        skill,
        stat: account.value.skills[skill],
        methods,
        hoursLeft: hoursLeft(account.value, skill),
        daysLeft: daysLeft(account.value, skill),
        isRough: isRoughEstimate(account.value, skill),
        fastestMethod: fastestMethod(account.value, skill, methods),
        nextUnlock: nextUnlock(account.value, skill, methods),
      }
    }),
  )

  /** How far the whole account is from maxing. */
  const maxProgress = computed<MaxProgress>(() => maxProgressOf(account.value))

  /** What is ticked and what was declined, as the rules that change them take it. */
  const ticks = computed<QuestTicks>(() => ({
    completedQuests: completedQuests.value,
    startedQuests: startedQuests.value,
    completedDiaries: completedDiaries.value,
    declinedQuests: declinedQuests.value,
    declinedDiaries: declinedDiaries.value,
  }))

  /**
   * The quests and diary tiers worth asking the player about now, the one to ask first at the
   * head. Worked out again whenever a tick, an answer or a level changes, because each of those
   * changes what the rest are worth.
   */
  const planQuestions = computed<PlanQuestions>(() => planQuestionsFor(account.value, ticks.value))

  /** Is any skill's hours figure rough? The total to max then is too. */
  const hasRoughEstimate = computed(() =>
    SKILL_KEYS.some((skill) => skillInsights.value[skill].isRough),
  )

  /** The order the capes hang on the rack: lowest level first. */
  const rackOrder = computed(() => rackOrderOf(account.value.skills))

  /** This store's part of the save. */
  const saved = computed<SavedAccount>(() => ({
    name: name.value,
    accountType: accountType.value,
    hiscores: hiscores.value,
    completedQuests: completedQuests.value,
    startedQuests: startedQuests.value,
    completedDiaries: completedDiaries.value,
    declinedQuests: declinedQuests.value,
    declinedDiaries: declinedDiaries.value,
    allQuests: allQuests.value,
    allDiaries: allDiaries.value,
    preferences: preferences.value,
    resetLog: resetLog.value,
  }))

  /**
   * Replaces everything here with what a save holds. Its ticks come in with what they prove
   * written in, so a save from before a rule was written gains what the rule proves.
   */
  function restore(save: SavedAccount): void {
    name.value = save.name
    accountType.value = save.accountType
    hiscores.value = save.hiscores
    setTicks(closeTicks(save))
    allQuests.value = save.allQuests
    allDiaries.value = save.allDiaries
    preferences.value = save.preferences
    resetLog.value = save.resetLog
  }

  /**
   * The account goes by a new name, as after a name change in the game, with the stats just looked
   * up under it. It is the same account, so everything else it has stays: its type, ticks, session,
   * history, preferences and reset log. (Planning for a different account is adding one: see the
   * account list store.)
   */
  function rename(newName: string, fresh: SavedHiscores): void {
    name.value = newName.trim()
    hiscores.value = fresh
  }

  /** Takes in freshly fetched hiscores. */
  function applyHiscores(fresh: SavedHiscores): void {
    hiscores.value = fresh
  }

  function setAccountType(type: AccountType): void {
    accountType.value = type
  }

  /** Takes in ticks the rules have changed. A list that did not change stays the same list, so nothing is saved again. */
  function setTicks(changed: QuestTicks): void {
    completedQuests.value = changed.completedQuests
    startedQuests.value = changed.startedQuests
    completedDiaries.value = changed.completedDiaries
    declinedQuests.value = changed.declinedQuests
    declinedDiaries.value = changed.declinedDiaries
  }

  /** How far the account has got with a quest, shortcuts and what the ticks prove included. */
  function questState(quest: string): QuestProgressState {
    return questProgress(account.value, quest)
  }

  /**
   * Moves a quest one step on, as a press of its tick box does: not done, then started (for a
   * quest whose start matters to something), then done, then back to not done. A quest brings its
   * chain with it: ticking one ticks every quest it requires and marks started the ones it needs
   * only started, and unticking one unticks everything that needs it finished. A quest that
   * something ticked needs started goes back to started and no further. Returns where it went and
   * what else moved, so the player can be told.
   */
  function stepQuest(quest: string): QuestStep {
    const from = questState(quest)
    const change =
      from === 'done'
        ? untickQuest(ticks.value, quest)
        : from === 'started' || !startedMatters(quest)
          ? tickQuest(ticks.value, quest)
          : startQuest(ticks.value, quest)
    setTicks(change.ticks)
    return { from, to: questState(quest), ...movedBy(change) }
  }

  /**
   * Marks a quest done, or only started, from a suggestion: forward only, since a suggestion is
   * for what is not done yet, so a quest already that far stays as it is. It brings its chain with
   * it as a tick does. Returns where it went and what else moved.
   */
  function markQuest(quest: string, state: QuestState): QuestStep {
    const from = questState(quest)
    if (from === 'done' || (state === 'started' && from === 'started'))
      return { from, to: from, ...MOVED_NOTHING }
    const change =
      state === 'finished' ? tickQuest(ticks.value, quest) : startQuest(ticks.value, quest)
    setTicks(change.ticks)
    return { from, to: questState(quest), ...movedBy(change) }
  }

  /** Marks a diary tier claimed from a suggestion: forward only, as `markQuest`. */
  function markDiary(diary: string): DiaryStep {
    if (hasCompletedDiary(account.value, diary)) return { ticked: true, ...MOVED_NOTHING }
    const change = tickDiary(ticks.value, diary)
    setTicks(change.ticks)
    return { ticked: true, ...movedBy(change) }
  }

  /**
   * Ticks a diary tier ('Ardougne Medium') done, which ticks the tiers below it and what its
   * tasks need; or unticks it, which unticks the tiers above it. Returns which way it went and
   * what else moved.
   */
  function toggleDiary(diary: string): DiaryStep {
    const ticked = !hasCompletedDiary(account.value, diary)
    const change = ticked ? tickDiary(ticks.value, diary) : untickDiary(ticks.value, diary)
    setTicks(change.ticks)
    return { ticked, ...movedBy(change) }
  }

  /**
   * Takes in the answer to a question about a quest or a diary tier. "Done" ticks it, and for a
   * quest every quest it requires; "not yet" is remembered so it is not asked again. Returns the
   * other quests a "done" ticked.
   */
  function answerQuestion(requirement: PlanRequirement, done: boolean): readonly string[] {
    const { kind, name } = requirement
    if (!done) {
      setTicks(kind === 'diary' ? declineDiary(ticks.value, name) : declineQuest(ticks.value, name))
      return []
    }
    const change = kind === 'diary' ? tickDiary(ticks.value, name) : tickQuest(ticks.value, name)
    setTicks(change.ticks)
    return change.alsoChanged
  }

  /**
   * Ticks what something other than the player's hand reports: a quest-progress add-on in a local
   * copy (see useStatsRefresh), with the quests finished, the quests started and the tiers
   * claimed. Ticks are only ever added, so whatever was ticked by hand stays.
   */
  function recordProgress(reported: ReportedProgress): void {
    setTicks(tickAll(ticks.value, reported))
  }

  /** The quest cape shortcut: counts every quest as done without ticking each. */
  function setAllQuests(done: boolean): void {
    allQuests.value = done
  }

  /** The diary cape shortcut: counts every diary as done without ticking each. */
  function setAllDiaries(done: boolean): void {
    allDiaries.value = done
  }

  function setPreference<Key extends keyof SavedPreferences>(
    key: Key,
    value: SavedPreferences[Key],
  ): void {
    preferences.value = { ...preferences.value, [key]: value }
  }

  /** Keeps a skill out of every deal, or lets it back in. */
  function setSkillExcluded(skill: SkillKey, excluded: boolean): void {
    setPreference('excludedSkills', withItem(preferences.value.excludedSkills, skill, excluded))
  }

  /** Logs a reset as done now, which restarts its timer. */
  function markResetDone(resetKey: string): void {
    resetLog.value = { ...resetLog.value, [resetKey]: Date.now() }
  }

  return {
    name,
    accountType,
    hiscores,
    completedQuests,
    startedQuests,
    completedDiaries,
    declinedQuests,
    declinedDiaries,
    allQuests,
    allDiaries,
    preferences,
    resetLog,
    hasAccount,
    isIronman,
    account,
    skillInsights,
    maxProgress,
    ticks,
    planQuestions,
    hasRoughEstimate,
    rackOrder,
    saved,
    restore,
    rename,
    applyHiscores,
    setAccountType,
    questState,
    stepQuest,
    markQuest,
    markDiary,
    toggleDiary,
    answerQuestion,
    recordProgress,
    setAllQuests,
    setAllDiaries,
    setPreference,
    setSkillExcluded,
    markResetDone,
  }
})

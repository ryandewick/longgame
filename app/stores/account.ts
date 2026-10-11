import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type { Account, AccountType } from '#shared/types/account'
import type { SkillKey, SkillStat } from '#shared/types/skill'
import { forEverySkill, SKILL_KEYS } from '#shared/data/skills'
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
import {
  declineDiary,
  declineQuest,
  tickAll,
  tickDiary,
  tickQuest,
  untickDiary,
  untickQuest,
  type QuestTicks,
} from '#shared/domain/quest-ticks'
import type { ResetLog } from '#shared/domain/resets'
import {
  accountFromSave,
  blankSave,
  type SavedHiscores,
  type SavedPreferences,
  type SavedState,
} from '#shared/domain/save'
import { useHistoryStore } from './history'
import { useSessionStore } from './session'

/** The part of the save this store keeps. */
export type SavedAccount = Pick<
  SavedState,
  | 'name'
  | 'accountType'
  | 'hiscores'
  | 'completedQuests'
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

/** What ticking or unticking one quest did to the others. */
export interface QuestToggle {
  /** True when the quest was ticked, false when it was unticked. */
  readonly ticked: boolean
  /** The other quests that had to be ticked or unticked with it (see shared/domain/quest-ticks.ts). */
  readonly alsoChanged: readonly string[]
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
  /** Quests ticked by hand, by name. */
  const completedQuests = shallowRef<readonly string[]>(blank.completedQuests)
  /** Diary tiers ticked by hand: 'Ardougne Medium'. */
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
    completedDiaries: completedDiaries.value,
    declinedQuests: declinedQuests.value,
    declinedDiaries: declinedDiaries.value,
    allQuests: allQuests.value,
    allDiaries: allDiaries.value,
    preferences: preferences.value,
    resetLog: resetLog.value,
  }))

  /** Replaces everything here with what a save holds. */
  function restore(save: SavedAccount): void {
    name.value = save.name
    accountType.value = save.accountType
    hiscores.value = save.hiscores
    completedQuests.value = save.completedQuests
    completedDiaries.value = save.completedDiaries
    declinedQuests.value = save.declinedQuests
    declinedDiaries.value = save.declinedDiaries
    allQuests.value = save.allQuests
    allDiaries.value = save.allDiaries
    preferences.value = save.preferences
    resetLog.value = save.resetLog
  }

  /**
   * Sets the player's name. A different name is a different account, so its stats, its session
   * and its history go; ticks, preferences and the reset log stay, as most players only ever
   * correct a typo. Returns whether the name changed.
   */
  function setName(newName: string): boolean {
    const trimmed = newName.trim()
    if (trimmed === name.value) return false
    name.value = trimmed
    hiscores.value = null
    accountType.value = null
    useSessionStore().clear()
    useHistoryStore().clear()
    return true
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
    completedDiaries.value = changed.completedDiaries
    declinedQuests.value = changed.declinedQuests
    declinedDiaries.value = changed.declinedDiaries
  }

  /**
   * Ticks a quest done, or unticks it. A quest brings its chain with it: ticking one ticks every
   * quest it requires, and unticking one unticks every quest that requires it. Returns which way
   * it went and what else moved, so the player can be told.
   */
  function toggleQuest(quest: string): QuestToggle {
    const ticked = !completedQuests.value.includes(quest)
    const change = ticked ? tickQuest(ticks.value, quest) : untickQuest(ticks.value, quest)
    setTicks(change.ticks)
    return { ticked, alsoChanged: change.alsoChanged }
  }

  /** Ticks a diary tier ('Ardougne Medium') done, or unticks it. */
  function toggleDiary(diary: string): void {
    const ticked = !completedDiaries.value.includes(diary)
    setTicks(ticked ? tickDiary(ticks.value, diary) : untickDiary(ticks.value, diary))
  }

  /**
   * Takes in the answer to a question about a quest or a diary tier. "Done" ticks it, and for a
   * quest every quest it requires; "not yet" is remembered so it is not asked again. Returns the
   * other quests a "done" ticked.
   */
  function answerQuestion(requirement: PlanRequirement, done: boolean): readonly string[] {
    const { kind, name } = requirement
    if (kind === 'diary') {
      setTicks(done ? tickDiary(ticks.value, name) : declineDiary(ticks.value, name))
      return []
    }
    if (!done) {
      setTicks(declineQuest(ticks.value, name))
      return []
    }
    const change = tickQuest(ticks.value, name)
    setTicks(change.ticks)
    return change.alsoChanged
  }

  /**
   * Ticks quests and diary tiers that something other than the player's hand reports as done: a
   * quest-progress add-on in a local copy (see useStatsRefresh). Ticks are only ever added, so
   * whatever was ticked by hand stays.
   */
  function recordCompleted(quests: readonly string[], diaries: readonly string[]): void {
    setTicks(tickAll(ticks.value, quests, diaries))
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

  /**
   * Forgets the account: stats, sessions, ticks and preferences all go back to blank. The XP
   * history in storage is left alone, so the same name can pick it up again later.
   */
  function forget(): void {
    restore(blankSave())
    useSessionStore().clear()
    useHistoryStore().clear()
  }

  return {
    name,
    accountType,
    hiscores,
    completedQuests,
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
    setName,
    applyHiscores,
    setAccountType,
    toggleQuest,
    toggleDiary,
    answerQuestion,
    recordCompleted,
    setAllQuests,
    setAllDiaries,
    setPreference,
    setSkillExcluded,
    markResetDone,
    forget,
  }
})

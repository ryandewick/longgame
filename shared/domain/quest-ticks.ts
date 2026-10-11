import { questDependants, questPrerequisites } from './quest-chains'

/*
 * What the player has told the app about their quests and diaries, and how one answer changes
 * it. Ticks and "not yet" answers are kept so that they never contradict each other: a quest is
 * never ticked while one it requires is not, and never both ticked and declined.
 */

/** The part of the save that says what is done and what the player has said is not. */
export interface QuestTicks {
  /** Quests ticked done, by name. */
  readonly completedQuests: readonly string[]
  /** Diary tiers ticked done: 'Ardougne Medium'. */
  readonly completedDiaries: readonly string[]
  /** Quests the player answered "Not yet" for, so they are not asked about again. */
  readonly declinedQuests: readonly string[]
  /** Diary tiers the player answered "Not yet" for. */
  readonly declinedDiaries: readonly string[]
}

/** Ticks after a change to one quest, and what else the change had to move. */
export interface QuestTickChange {
  readonly ticks: QuestTicks
  /** The other quests ticked or unticked along with the one asked for, in name order. */
  readonly alsoChanged: readonly string[]
}

/** The list with these items added. The same list comes back when it already had them all. */
function withAll(list: readonly string[], items: readonly string[]): readonly string[] {
  const missing = items.filter((item) => !list.includes(item))
  return missing.length ? [...list, ...missing] : list
}

/** The list with none of these items. The same list comes back when it had none of them. */
function withoutAll(list: readonly string[], items: readonly string[]): readonly string[] {
  return list.some((item) => items.includes(item))
    ? list.filter((item) => !items.includes(item))
    : list
}

/**
 * Ticks a quest done. Every quest it requires is ticked with it, because it cannot have been
 * finished without them, and none of them stays declined: finishing a quest outranks an earlier
 * "not yet" for anything on the way to it.
 */
export function tickQuest(ticks: QuestTicks, quest: string): QuestTickChange {
  const chain = [quest, ...questPrerequisites(quest)]
  const added = chain.filter((link) => !ticks.completedQuests.includes(link))
  return {
    ticks: {
      ...ticks,
      completedQuests: withAll(ticks.completedQuests, added),
      declinedQuests: withoutAll(ticks.declinedQuests, chain),
    },
    alsoChanged: added.filter((link) => link !== quest),
  }
}

/**
 * Unticks a quest. Every ticked quest that requires it is unticked with it, so that no quest is
 * left ticked without one it needs. Nothing becomes declined: an unticked quest is one the app
 * does not know about, and may ask about again.
 */
export function untickQuest(ticks: QuestTicks, quest: string): QuestTickChange {
  const chain = [quest, ...questDependants(quest)]
  const removed = chain.filter((link) => ticks.completedQuests.includes(link))
  return {
    ticks: { ...ticks, completedQuests: withoutAll(ticks.completedQuests, removed) },
    alsoChanged: removed.filter((link) => link !== quest),
  }
}

/**
 * Records a "not yet" for a quest. Only the quest itself is stored: the quests that require it
 * are ruled out from it each time (`questsRuledOut`), so one tick later puts everything right.
 * A ticked quest stays ticked; unticking is its own action.
 */
export function declineQuest(ticks: QuestTicks, quest: string): QuestTicks {
  if (ticks.completedQuests.includes(quest)) return ticks
  return { ...ticks, declinedQuests: withAll(ticks.declinedQuests, [quest]) }
}

/** Ticks a diary tier done, which also takes back a "not yet" for it. Tiers imply nothing about each other. */
export function tickDiary(ticks: QuestTicks, diary: string): QuestTicks {
  return {
    ...ticks,
    completedDiaries: withAll(ticks.completedDiaries, [diary]),
    declinedDiaries: withoutAll(ticks.declinedDiaries, [diary]),
  }
}

/** Unticks a diary tier. */
export function untickDiary(ticks: QuestTicks, diary: string): QuestTicks {
  return { ...ticks, completedDiaries: withoutAll(ticks.completedDiaries, [diary]) }
}

/** Records a "not yet" for a diary tier. A ticked tier stays ticked. */
export function declineDiary(ticks: QuestTicks, diary: string): QuestTicks {
  if (ticks.completedDiaries.includes(diary)) return ticks
  return { ...ticks, declinedDiaries: withAll(ticks.declinedDiaries, [diary]) }
}

/**
 * Ticks everything in two lists at once, as `tickQuest` and `tickDiary` would one by one: what a
 * quest-progress add-on reports.
 */
export function tickAll(
  ticks: QuestTicks,
  quests: readonly string[],
  diaries: readonly string[],
): QuestTicks {
  let ticked = ticks
  for (const quest of quests) ticked = tickQuest(ticked, quest).ticks
  for (const diary of diaries) ticked = tickDiary(ticked, diary)
  return ticked
}

import { questDependants } from './quest-chains'
import {
  diaryProvesFinished,
  higherTiers,
  inDiaryOrder,
  neededStartedBy,
  provenProgress,
  startedMatters,
} from './quest-proof'

/*
 * What the player has told the app about their quests and diaries, and how one answer changes
 * it. Ticks and "not yet" answers are kept so that they never contradict each other: a quest is
 * never ticked while one it requires is not, a tier never while one below it is not, and nothing
 * is both ticked and declined. Every change writes in what the ticks prove (quest-proof.ts), and
 * an untick takes away whatever needed the quest or tier it took away.
 */

/** The part of the save that says what is done and what the player has said is not. */
export interface QuestTicks {
  /** Quests ticked done, by name. */
  readonly completedQuests: readonly string[]
  /** Quests started and not finished: only ever ones whose start matters to something. */
  readonly startedQuests: readonly string[]
  /** Diary tiers ticked done: 'Ardougne Medium'. */
  readonly completedDiaries: readonly string[]
  /** Quests the player answered "Not yet" for, so they are not asked about again. */
  readonly declinedQuests: readonly string[]
  /** Diary tiers the player answered "Not yet" for. */
  readonly declinedDiaries: readonly string[]
}

/** Ticks after a change, and what else the change had to move. */
export interface QuestTickChange {
  readonly ticks: QuestTicks
  /** The other quests ticked, or unticked, along with the change, in name order. */
  readonly alsoChanged: readonly string[]
  /** The other quests newly marked started, because something ticked needs them started. */
  readonly alsoStarted: readonly string[]
  /** The diary tiers ticked, or unticked, along with the change, in the game's order. */
  readonly diariesChanged: readonly string[]
  /**
   * When an untick could take its quest back only as far as started: the finished quests and
   * claimed tiers that need it started, in name order, tiers last. Empty otherwise.
   */
  readonly heldStartedBy: readonly string[]
}

/** The list with these items added. The same list comes back when it already had them all. */
function withAll(list: readonly string[], items: Iterable<string>): readonly string[] {
  const missing = [...items].filter((item) => !list.includes(item))
  return missing.length ? [...list, ...new Set(missing)] : list
}

/** The list with none of these items. The same list comes back when it had none of them. */
function withoutAll(list: readonly string[], items: Iterable<string>): readonly string[] {
  const gone = new Set(items)
  return list.some((item) => gone.has(item)) ? list.filter((item) => !gone.has(item)) : list
}

/** Plain code-point order, not a locale's: the order must come out the same on every machine. */
function byName(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0
}

/**
 * The ticks with everything they prove written in: the quests a finished quest requires, the ones
 * it needs only started, the tiers below a claimed tier and the quests its tasks need. A quest
 * finished is no longer kept as started, and nothing proven done stays declined. What is added
 * goes at the end of its list, quests in name order and tiers in the game's order. The same
 * object comes back when there was nothing to add.
 */
export function closeTicks(ticks: QuestTicks): QuestTicks {
  const proven = provenProgress(ticks)
  const finished = [...proven.completedQuests].sort(byName)
  const completedQuests = withAll(ticks.completedQuests, finished)
  const startedQuests = withAll(
    withoutAll(ticks.startedQuests, finished),
    [...proven.startedQuests].sort(byName),
  )
  const completedDiaries = withAll(ticks.completedDiaries, inDiaryOrder(proven.completedDiaries))
  const declinedQuests = withoutAll(ticks.declinedQuests, finished)
  const declinedDiaries = withoutAll(ticks.declinedDiaries, proven.completedDiaries)
  const unchanged =
    completedQuests === ticks.completedQuests &&
    startedQuests === ticks.startedQuests &&
    completedDiaries === ticks.completedDiaries &&
    declinedQuests === ticks.declinedQuests &&
    declinedDiaries === ticks.declinedDiaries
  return unchanged
    ? ticks
    : { completedQuests, startedQuests, completedDiaries, declinedQuests, declinedDiaries }
}

/** Items in one list and not the other, either way round. */
function difference(before: readonly string[], after: readonly string[]): string[] {
  const was = new Set(before)
  const is = new Set(after)
  return [...before.filter((item) => !is.has(item)), ...after.filter((item) => !was.has(item))]
}

/** What a change moved besides the quest or tier it was for. */
function changeBetween(
  before: QuestTicks,
  after: QuestTicks,
  own: string,
  heldStartedBy: readonly string[] = [],
): QuestTickChange {
  const wasStarted = new Set(before.startedQuests)
  return {
    ticks: after,
    alsoChanged: difference(before.completedQuests, after.completedQuests)
      .filter((quest) => quest !== own)
      .sort(byName),
    alsoStarted: after.startedQuests
      .filter((quest) => quest !== own && !wasStarted.has(quest))
      .sort(byName),
    diariesChanged: inDiaryOrder(
      difference(before.completedDiaries, after.completedDiaries).filter((diary) => diary !== own),
    ),
    heldStartedBy,
  }
}

/**
 * Ticks a quest done. Every quest it requires is ticked with it, because it cannot have been
 * finished without them, and every quest it needs only started is marked started. None of them
 * stays declined: finishing a quest outranks an earlier "not yet" for anything on the way to it.
 */
export function tickQuest(ticks: QuestTicks, quest: string): QuestTickChange {
  const after = closeTicks({ ...ticks, completedQuests: withAll(ticks.completedQuests, [quest]) })
  return changeBetween(ticks, after, quest)
}

/**
 * Unticks a quest, or takes a started quest back to not started. Every ticked quest that requires
 * it is unticked with it, and so is every claimed tier whose tasks need it (or one of those)
 * finished, with the tiers above that one, so that nothing is left ticked without what it needs.
 * Nothing becomes declined: an unticked quest is one the app does not know about, and may ask
 * about again.
 *
 * A quest that something still ticked needs started goes back to started and no further, and the
 * change says what holds it there (`heldStartedBy`).
 */
export function untickQuest(ticks: QuestTicks, quest: string): QuestTickChange {
  const quests = [quest, ...questDependants(quest)]
  const needing = ticks.completedDiaries.filter((diary) =>
    quests.some((link) => diaryProvesFinished(diary, link)),
  )
  const diaries = [...needing, ...needing.flatMap(higherTiers)]
  const after = closeTicks({
    ...ticks,
    completedQuests: withoutAll(ticks.completedQuests, quests),
    startedQuests: withoutAll(ticks.startedQuests, [quest]),
    completedDiaries: withoutAll(ticks.completedDiaries, diaries),
  })
  const held = after.startedQuests.includes(quest)
    ? neededStartedBy(quest, provenProgress(after))
    : []
  return changeBetween(ticks, after, quest, held)
}

/**
 * Marks a quest started and not finished. A quest that was ticked done is unticked first (see
 * `untickQuest`) and then kept as started. Starting a quest proves nothing else: a quest can be
 * started before everything it needs is done.
 */
export function startQuest(ticks: QuestTicks, quest: string): QuestTickChange {
  const lowered = ticks.completedQuests.includes(quest) ? untickQuest(ticks, quest).ticks : ticks
  const after = closeTicks({ ...lowered, startedQuests: withAll(lowered.startedQuests, [quest]) })
  return changeBetween(ticks, after, quest)
}

/**
 * Records a "not yet" for a quest. Only the quest itself is stored: the quests that require it
 * are ruled out from it each time (`questsRuledOut`), so one tick later puts everything right.
 * A ticked quest stays ticked; unticking is its own action. A started quest can be declined: "not
 * yet" says it is not finished.
 */
export function declineQuest(ticks: QuestTicks, quest: string): QuestTicks {
  if (ticks.completedQuests.includes(quest)) return ticks
  return { ...ticks, declinedQuests: withAll(ticks.declinedQuests, [quest]) }
}

/**
 * Ticks a diary tier done. A tier's reward can only be claimed once every tier below it is, so
 * those are ticked with it, and so is what its tasks need: the quests finished or started, as
 * its page reads them. None of it stays declined.
 */
export function tickDiary(ticks: QuestTicks, diary: string): QuestTickChange {
  const after = closeTicks({ ...ticks, completedDiaries: withAll(ticks.completedDiaries, [diary]) })
  return changeBetween(ticks, after, diary)
}

/**
 * Unticks a diary tier, and every tier above it, which could not have been claimed without it.
 * The quests it proved stay as they are, as the quests a quest requires do when it is unticked.
 */
export function untickDiary(ticks: QuestTicks, diary: string): QuestTickChange {
  const after = closeTicks({
    ...ticks,
    completedDiaries: withoutAll(ticks.completedDiaries, [diary, ...higherTiers(diary)]),
  })
  return changeBetween(ticks, after, diary)
}

/** Records a "not yet" for a diary tier. A ticked tier stays ticked. */
export function declineDiary(ticks: QuestTicks, diary: string): QuestTicks {
  if (ticks.completedDiaries.includes(diary)) return ticks
  return { ...ticks, declinedDiaries: withAll(ticks.declinedDiaries, [diary]) }
}

/** What a quest-progress add-on reports: quests finished, quests started, tiers claimed. */
export interface ReportedProgress {
  readonly quests: readonly string[]
  readonly started?: readonly string[]
  readonly diaries: readonly string[]
}

/**
 * Ticks everything a quest-progress add-on reports at once, as `tickQuest`, `startQuest` and
 * `tickDiary` would one by one. Only ever adds: a started quest already ticked done stays done,
 * and a quest reported started is kept only where its start matters to something.
 */
export function tickAll(ticks: QuestTicks, reported: ReportedProgress): QuestTicks {
  const finished = new Set([...ticks.completedQuests, ...reported.quests])
  const completedQuests = withAll(ticks.completedQuests, reported.quests)
  const startedQuests = withAll(
    ticks.startedQuests,
    (reported.started ?? []).filter((quest) => startedMatters(quest) && !finished.has(quest)),
  )
  const completedDiaries = withAll(ticks.completedDiaries, reported.diaries)
  const nothingNew =
    completedQuests === ticks.completedQuests &&
    startedQuests === ticks.startedQuests &&
    completedDiaries === ticks.completedDiaries
  return closeTicks(
    nothingNew ? ticks : { ...ticks, completedQuests, startedQuests, completedDiaries },
  )
}

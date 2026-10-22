import { DIARY_REGIONS, DIARY_TIERS } from '../data/diaries'
import { DIARY_FACTS } from '../data/diary-facts'
import { QUEST_FACTS } from '../data/quest-facts'
import { questPrerequisites } from './quest-chains'

/*
 * What ticks prove. A finished quest proves every quest it requires finished, and the quests it
 * needs only started, started. A claimed diary tier proves the tiers below it, since a tier's
 * reward can only be claimed once they are, and the quests its tasks need, as far as its page says
 * they need them (Ardougne Medium: Fairytale II started, Plague City finished). A started quest
 * proves nothing more: a quest can be started before everything it needs is done.
 *
 * Ticks are kept with all of this written in (quest-ticks.ts), and the account is read through it
 * (save.ts), so a save from before a rule existed gains what the rule proves.
 */

/** What is ticked: the quests finished, the quests started, the diary tiers claimed. */
export interface TickedProgress {
  readonly completedQuests: Iterable<string>
  readonly startedQuests: Iterable<string>
  readonly completedDiaries: Iterable<string>
}

/** Everything the ticks prove, all the way along. A quest is in one of the two quest sets at most. */
export interface ProvenProgress {
  readonly completedQuests: ReadonlySet<string>
  /** Quests started and not finished. */
  readonly startedQuests: ReadonlySet<string>
  readonly completedDiaries: ReadonlySet<string>
}

const STARTED_LINKS: ReadonlyMap<string, readonly string[]> = new Map(
  QUEST_FACTS.map((quest) => [quest.name, quest.requiresStarted]),
)

const START_MATTERS: ReadonlySet<string> = new Set(
  QUEST_FACTS.filter((quest) => quest.startedMatters).map((quest) => quest.name),
)

/**
 * Does anything need this quest only started (another quest, a diary tier, an either-or choice, a
 * goal)? Only such a quest is kept as started: for any other, started tells the planner nothing.
 */
export function startedMatters(quest: string): boolean {
  return START_MATTERS.has(quest)
}

const DIARY_QUESTS: ReadonlyMap<string, readonly (readonly [string, string])[]> = new Map(
  DIARY_FACTS.map((diary) => [diary.name, Object.entries(diary.quests)]),
)

/** Where each tier stands in the game's order: region by region, easiest first. */
const DIARY_PLACE: ReadonlyMap<string, number> = new Map(
  DIARY_FACTS.map((diary, place) => [diary.name, place]),
)

/** A tier as its region and its place among the four, or null for a name that is not a tier. */
function tierOf(diary: string): { readonly region: string; readonly level: number } | null {
  for (const [level, tier] of DIARY_TIERS.entries()) {
    const suffix = ` ${tier}`
    if (!diary.endsWith(suffix)) continue
    const region = diary.slice(0, -suffix.length)
    return DIARY_REGIONS.includes(region) ? { region, level } : null
  }
  return null
}

/** The tiers of the same diary below this one, easiest first: Easy and Medium for 'Ardougne Hard'. */
export function lowerTiers(diary: string): string[] {
  const found = tierOf(diary)
  if (!found) return []
  return DIARY_TIERS.slice(0, found.level).map((tier) => `${found.region} ${tier}`)
}

/** The tiers of the same diary above this one, easiest first: Hard and Elite for 'Ardougne Medium'. */
export function higherTiers(diary: string): string[] {
  const found = tierOf(diary)
  if (!found) return []
  return DIARY_TIERS.slice(found.level + 1).map((tier) => `${found.region} ${tier}`)
}

/** Tiers in the game's order, region by region and easiest first; a name that is not a tier goes last. */
export function inDiaryOrder(diaries: Iterable<string>): string[] {
  const place = (diary: string): number => DIARY_PLACE.get(diary) ?? DIARY_PLACE.size
  return [...diaries].sort((first, second) => place(first) - place(second))
}

/** The quests a tier's tasks need in this state, as its page reads them. */
function diaryNeeds(diary: string, state: string): string[] {
  return (DIARY_QUESTS.get(diary) ?? [])
    .filter(([, need]) => need === state)
    .map(([quest]) => quest)
}

/**
 * Everything the ticks prove. With `everyDiary` (the diary cape shortcut) every tier counts as
 * claimed, and so proves what it would if ticked.
 */
export function provenProgress(ticks: TickedProgress, everyDiary = false): ProvenProgress {
  const diaries = new Set<string>()
  for (const diary of everyDiary ? DIARY_FACTS.map(({ name }) => name) : ticks.completedDiaries) {
    diaries.add(diary)
    for (const lower of lowerTiers(diary)) diaries.add(lower)
  }

  const finished = new Set<string>()
  const finish = (quest: string): void => {
    if (finished.has(quest)) return
    finished.add(quest)
    for (const prerequisite of questPrerequisites(quest)) finished.add(prerequisite)
  }
  for (const quest of ticks.completedQuests) finish(quest)
  for (const diary of diaries) for (const quest of diaryNeeds(diary, 'finished')) finish(quest)

  const started = new Set<string>(ticks.startedQuests)
  for (const quest of finished) for (const link of STARTED_LINKS.get(quest) ?? []) started.add(link)
  for (const diary of diaries) for (const quest of diaryNeeds(diary, 'started')) started.add(quest)
  for (const quest of finished) started.delete(quest)

  return { completedQuests: finished, startedQuests: started, completedDiaries: diaries }
}

/**
 * The finished quests and claimed tiers that need this quest started, in name order: why it can
 * go back to started and no further while they stay ticked.
 */
export function neededStartedBy(quest: string, proven: ProvenProgress): string[] {
  const quests = [...proven.completedQuests].filter((done) =>
    (STARTED_LINKS.get(done) ?? []).includes(quest),
  )
  const diaries = [...proven.completedDiaries].filter((diary) =>
    diaryNeeds(diary, 'started').includes(quest),
  )
  return [...quests.sort(byName), ...inDiaryOrder(diaries)]
}

/** Plain code-point order, not a locale's: the order must come out the same on every machine. */
function byName(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0
}

/** Every quest a tier proves finished, the quests those require included. Worked out once. */
const DIARY_FINISHED: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  DIARY_FACTS.map((diary) => [
    diary.name,
    new Set(
      diaryNeeds(diary.name, 'finished').flatMap((quest) => [quest, ...questPrerequisites(quest)]),
    ),
  ]),
)

/** Does this tier, once claimed, prove the quest finished? */
export function diaryProvesFinished(diary: string, quest: string): boolean {
  return DIARY_FINISHED.get(diary)?.has(quest) ?? false
}

import { QUEST_LIST_NAMES } from './build-quests'
import { DataSourceError, QUEST_PREREQUISITE_MODULE } from './sources'
import type { QuestPrerequisiteSource } from './sources'

/** Which quests each quest needs finished first, for the quests the app knows. */
export interface QuestPrerequisites {
  /**
   * Each quest that requires others, with the quests it requires, in name order. A requirement
   * the app does not track (Troll Stronghold pays no XP and gates nothing) is replaced by what
   * that one requires in turn, so the chain through it is kept.
   */
  readonly requires: ReadonlyMap<string, readonly string[]>
  /**
   * The app's quests whose entry was read from the quest's own wiki page, because the wiki's
   * module has none for them, in name order.
   */
  readonly fromOwnPage: readonly string[]
  /** The app's quests with no entry at all: what they require is not known. In name order. */
  readonly unlisted: readonly string[]
}

/** A requirement that only has to be started says nothing about what has been finished. */
const STARTED_PREFIX = 'Started:'

/** The placeholders of the module's own template, in case a copy of it is ever read as an entry. */
const TEMPLATE_NAMES: ReadonlySet<string> = new Set(['Name_of_quest', 'subquest'])

/** Where the module names a quest differently from the quest list the player ticks. */
const MODULE_NAMES: Readonly<Record<string, string>> = {
  ...QUEST_LIST_NAMES,
  'Natural History Quiz': 'Natural history quiz',
  // the wiki's page title tells the miniquest from the minigame of the same name
  'Vale Totems (miniquest)': 'Vale Totems',
}

/**
 * Requirements the module names without having an entry for them, which the app does not track
 * either. Listed one by one, so that a name nobody has looked at stops the build.
 */
const UNTRACKED_WITHOUT_ENTRY: ReadonlySet<string> = new Set(['Architectural Alliance'])

/** A name as the app spells it: no stray spaces, straight apostrophes, the quest list's title. */
function cleanName(name: string): string {
  const tidy = name.trim().replaceAll('’', "'")
  return MODULE_NAMES[tidy] ?? tidy
}

/** The first chain of requirements that comes back to where it started, or null when none does. */
function findCycle(requires: ReadonlyMap<string, readonly string[]>): string[] | null {
  const settled = new Set<string>()
  const walk = (quest: string, path: readonly string[]): string[] | null => {
    if (path.includes(quest)) return [...path.slice(path.indexOf(quest)), quest]
    if (settled.has(quest)) return null
    for (const required of requires.get(quest) ?? []) {
      const cycle = walk(required, [...path, quest])
      if (cycle) return cycle
    }
    settled.add(quest)
    return null
  }
  for (const quest of requires.keys()) {
    const cycle = walk(quest, [])
    if (cycle) return cycle
  }
  return null
}

/**
 * Turns the wiki's quest requirements into the chains between the quests the app knows.
 *
 * - Only full completions count: a requirement marked 'Started:' is left out.
 * - Names are made to match the app's: apostrophes straightened, stray spaces trimmed, the
 *   Recipe for Disaster subquests given their quest-list titles.
 * - An entry the app does not track (a quest that pays no XP and gates nothing, a miniquest, an
 *   activity, a diary) is not kept, but what it requires passes to whatever required it.
 * - A requirement that is neither a quest the app knows, an entry of the module nor a name
 *   listed as untracked is a problem, and so is a chain that comes back on itself.
 *
 * Throws a DataSourceError listing everything wrong with the source.
 */
export function buildQuestPrerequisites(
  source: Readonly<Record<string, QuestPrerequisiteSource>>,
  knownQuests: readonly string[],
): QuestPrerequisites {
  const problems: string[] = []
  const known = new Set(knownQuests)

  const entries = new Map<string, readonly string[]>()
  const fromOwnPage: string[] = []
  for (const [sourceName, entry] of Object.entries(source)) {
    if (TEMPLATE_NAMES.has(sourceName)) continue
    const name = cleanName(sourceName)
    if (entries.has(name)) problems.push(`quest prerequisites: '${name}' has two entries`)
    if (!entry.src.trim()) problems.push(`quest prerequisites: '${name}' has no source page`)
    entries.set(name, entry.requires)
    if (known.has(name) && entry.src !== QUEST_PREREQUISITE_MODULE) fromOwnPage.push(name)
  }

  /** The known quests behind one listed requirement: itself, or what an untracked entry requires. */
  const resolve = (required: string, from: string, passed: readonly string[]): string[] => {
    if (required.startsWith(STARTED_PREFIX) || TEMPLATE_NAMES.has(required)) return []
    const name = cleanName(required)
    if (known.has(name)) return [name]
    if (UNTRACKED_WITHOUT_ENTRY.has(name)) return []
    const untracked = entries.get(name)
    if (!untracked) {
      problems.push(`quest prerequisites: ${from} requires '${required}', which nothing knows`)
      return []
    }
    // untracked entries that require each other in a ring would never end
    if (passed.includes(name)) {
      problems.push(`quest prerequisites: ${[...passed, name].join(' > ')} is a cycle`)
      return []
    }
    return untracked.flatMap((next) => resolve(next, name, [...passed, name]))
  }

  const requires = new Map<string, readonly string[]>()
  for (const [name, listed] of entries) {
    if (!known.has(name)) continue
    const required = new Set(listed.flatMap((entry) => resolve(entry, name, [])))
    if (required.size) requires.set(name, [...required].sort())
  }

  const cycle = findCycle(requires)
  if (cycle) problems.push(`quest prerequisites: ${cycle.join(' > ')} is a cycle`)
  if (problems.length) throw new DataSourceError(problems)

  return {
    requires,
    fromOwnPage: fromOwnPage.sort(),
    unlisted: knownQuests.filter((quest) => !entries.has(quest)).sort(),
  }
}

import type { LampReward, QuestFacts, QuestKind } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { lampsInWords } from './build-quests'
import { isSkillKey } from './skills'
import { DataSourceError } from './sources'
import type { QuestFactLampSource, QuestFactSource } from './sources'

const KINDS: readonly string[] = ['quest', 'subquest', 'miniquest', 'activity']

const isKind = (kind: string): kind is QuestKind => KINDS.includes(kind)

/** Plain code-point order, not a locale's: the list must come out the same on every machine. */
const byName = (first: string, second: string): number =>
  first < second ? -1 : first > second ? 1 : 0

/**
 * The museum's lamps in words, one sentence per kind of lamp: 'A 1,000 xp lamp from Historian
 * Minas for any skill at level 20 or above.'
 */
function lampReward(lamps: readonly QuestFactLampSource[]): LampReward {
  const sentences = lamps.map(
    ({ count, xp, minLevel, from }) =>
      `${lampsInWords(count, xp)} from ${from} for any skill at level ${minLevel} or above.`,
  )
  return {
    description: sentences.join(' '),
    totalXp: lamps.reduce((sum, { count, xp }) => sum + count * xp, 0),
  }
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

const isLevel = (level: number): boolean => Number.isInteger(level) && level >= 1 && level <= 99

/** What is wrong with one lamp entry: nothing, when it is sound. */
function lampProblems(name: string, lamp: QuestFactLampSource): string[] {
  const problems: string[] = []
  if (!(Number.isInteger(lamp.count) && lamp.count >= 1))
    problems.push(`${name}: lamp count ${lamp.count}`)
  if (!(Number.isInteger(lamp.xp) && lamp.xp > 0)) problems.push(`${name}: lamp xp ${lamp.xp}`)
  if (!isLevel(lamp.minLevel)) problems.push(`${name}: lamp level ${lamp.minLevel}`)
  if (!lamp.from.trim()) problems.push(`${name}: a lamp from nobody`)
  return problems
}

/**
 * Turns datasrc/quest_facts.json into the app's `QuestFacts`, in name order. Every field is
 * checked: a known kind, a page and revision, levels from 1 to 99 in skills the app knows, quests
 * needed that are entries themselves, no chain of them that comes back on itself (counting the
 * ones needed only started), a quest needed only started that is marked as one whose start
 * matters, and names spelt as the player's ticks are stored (straight apostrophes, no stray
 * spaces). A quest's `requires` joins the quests its page names and the ones its levels prove.
 *
 * Throws a DataSourceError listing everything wrong with the source.
 */
export function buildQuestFacts(source: Readonly<Record<string, QuestFactSource>>): QuestFacts[] {
  const problems: string[] = []
  const names = new Set(Object.keys(source))
  const facts: QuestFacts[] = []
  const startedMatters = (quest: string): boolean => source[quest]?.startedMatters === true

  for (const [name, entry] of Object.entries(source)) {
    if (name !== name.trim() || name.includes('’')) problems.push(`'${name}': spelt unlike a tick`)
    if (!isKind(entry.kind)) problems.push(`${name}: kind '${entry.kind}'`)
    if (!entry.page.trim()) problems.push(`${name}: no page`)
    if (!(Number.isInteger(entry.rev) && entry.rev > 0))
      problems.push(`${name}: revision ${entry.rev}`)

    const levels: Partial<Record<SkillKey, number>> = {}
    for (const [skill, level] of Object.entries(entry.levels ?? {})) {
      if (!isSkillKey(skill)) problems.push(`${name}: needs unknown skill '${skill}'`)
      else if (!isLevel(level)) problems.push(`${name}: ${skill} ${level}`)
      else levels[skill] = level
    }

    const linked = [...(entry.requires ?? []), ...(entry.implies ?? [])]
    const started = entry.requiresStarted ?? []
    for (const quest of [...linked, ...started]) {
      if (quest === name) problems.push(`${name}: needs itself`)
      else if (!names.has(quest)) problems.push(`${name}: needs '${quest}', which is not an entry`)
    }
    for (const list of [entry.requires ?? [], entry.implies ?? [], started]) {
      if (new Set(list).size !== list.length) problems.push(`${name}: a quest needed twice`)
    }
    for (const quest of started) {
      if (linked.includes(quest)) problems.push(`${name}: needs '${quest}' finished and started`)
      else if (names.has(quest) && !startedMatters(quest))
        problems.push(`${name}: needs '${quest}' started, which is not marked as mattering started`)
    }

    for (const lamp of entry.lamps ?? []) problems.push(...lampProblems(name, lamp))
    if (entry.optional && entry.kind !== 'miniquest')
      problems.push(`${name}: optional, but not a miniquest`)

    facts.push({
      name,
      kind: isKind(entry.kind) ? entry.kind : 'quest',
      page: entry.page,
      revision: entry.rev,
      levels,
      requires: [...new Set(linked)].sort(byName),
      requiresStarted: [...started].sort(byName),
      ...(entry.lamps?.length ? { lamps: lampReward(entry.lamps) } : {}),
      optional: entry.optional === true,
      doneByEveryAccount: entry.everyAccount === true,
      startedMatters: entry.startedMatters === true,
    })
  }

  const cycle = findCycle(
    new Map(facts.map((quest) => [quest.name, [...quest.requires, ...quest.requiresStarted]])),
  )
  if (cycle) problems.push(`${cycle.join(' > ')} is a cycle`)
  if (problems.length)
    throw new DataSourceError(problems.map((problem) => `quest facts: ${problem}`))

  return facts.sort((first, second) => byName(first.name, second.name))
}

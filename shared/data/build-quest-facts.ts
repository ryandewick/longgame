import type {
  GuidePlace,
  IronmanNeed,
  LampReward,
  QuestFacts,
  QuestKind,
  XpChoice,
} from '../types/quest'
import type { SkillKey } from '../types/skill'
import { lampsInWords } from './build-quests'
import { isLevel, readCount, readLevelNeed, readMinutes, readSkillList } from './read-needs'
import { isSkillKey } from './skills'
import { DataSourceError } from './sources'
import type { QuestFactLampSource, QuestFactSource } from './sources'

const GUIDES: readonly string[] = ['main', 'ironman']

/** The XP a player chooses the skill of, without the choices that are not sound (each noted as a problem). */
function xpChoices(problems: string[], name: string, entry: QuestFactSource): XpChoice[] {
  return (entry.xpChoices ?? []).flatMap((choice) => {
    const listed = Array.isArray(choice.skills) ? choice.skills : []
    const skills =
      choice.skills === 'any'
        ? 'any'
        : listed.length && listed.every(isSkillKey)
          ? listed.filter(isSkillKey)
          : null
    const sound =
      Number.isInteger(choice.count) &&
      choice.count >= 1 &&
      Number.isInteger(choice.xp) &&
      choice.xp > 0 &&
      (choice.minLevel === 0 || isLevel(choice.minLevel))
    if (!skills || !sound) {
      problems.push(
        `${name}: an xp choice of ${choice.count} x ${choice.xp} in ${String(choice.skills)}`,
      )
      return []
    }
    return [{ count: choice.count, xp: choice.xp, skills, minLevel: choice.minLevel }]
  })
}

/** Where a guide does a quest: a step that finishes it, and an earlier one that starts it. */
function guidePlace(
  problems: string[],
  where: string,
  place: { finish?: number; start?: number } | undefined,
): GuidePlace | null {
  if (!place) return null
  const step = (value: number | undefined): number | null =>
    value !== undefined && Number.isInteger(value) && value > 0 ? value : null
  const finish = step(place.finish)
  const start = step(place.start)
  const bad =
    (place.finish !== undefined && finish === null) ||
    (place.start !== undefined && start === null) ||
    (finish === null && start === null) ||
    (finish !== null && start !== null && start >= finish)
  if (bad) problems.push(`${where}: guide steps ${place.start} to ${place.finish}`)
  return { finish, start }
}

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
 * What readiness reads is checked too: the boostable, finish-only and bypassable levels name
 * levels the quest needs, an ironman's options are real levels, the counts are whole numbers, and
 * only a quest or a part of Recipe for Disaster gives quest points. What suggestions read is
 * checked as well: minutes in order, XP choices and XP during a quest in real skills, and guide
 * steps that start a quest before they finish it.
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

    const ironman: IronmanNeed[] = (entry.ironman ?? []).map((need) => {
      if (!need.need.trim()) problems.push(`${name}: an ironman need with no name`)
      if (!need.options.length || need.options.some((option) => !option.length))
        problems.push(`${name}: an ironman need with an empty option`)
      return {
        need: need.need,
        options: need.options.map((option) =>
          option.flatMap((level) => readLevelNeed(problems, `${name} ironman`, level) ?? []),
        ),
        condition: need.condition?.trim() || null,
      }
    })
    if (entry.givesQuestPoints && entry.kind !== 'quest' && entry.kind !== 'subquest')
      problems.push(`${name}: gives quest points, but is not a quest`)

    const xpDuring: Partial<Record<SkillKey, number>> = {}
    for (const [skill, xp] of Object.entries(entry.xpDuring ?? {})) {
      if (!isSkillKey(skill) || !(Number.isInteger(xp) && xp > 0))
        problems.push(`${name}: xp during of ${xp} in '${skill}'`)
      else xpDuring[skill] = xp
    }
    for (const route of Object.keys(entry.guide ?? {})) {
      if (!GUIDES.includes(route)) problems.push(`${name}: a guide '${route}'`)
    }

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
      needs: {
        boostable: readSkillList(problems, name, 'boostable', entry.boostable, levels),
        finishOnly: readSkillList(problems, name, 'finishOnly', entry.finishOnly, levels),
        bypassable: readSkillList(problems, name, 'bypassable', entry.bypassable, levels),
        questPoints: readCount(problems, name, 'quest points needed', entry.questPoints),
        combat: readCount(problems, name, 'combat level needed', entry.combat),
        kudos: readCount(problems, name, 'Kudos needed', entry.kudos),
        ironman,
      },
      gives: {
        questPoints: readCount(problems, name, 'quest points given', entry.givesQuestPoints),
        kudos: readCount(problems, name, 'Kudos given', entry.givesKudos),
        kudosOpened: readCount(problems, name, 'Kudos opened', entry.opensKudos),
        xpChoices: xpChoices(problems, name, entry),
        xpDuring,
      },
      time: {
        minutes: entry.minutes ? readMinutes(problems, name, entry.minutes) : null,
        ironmanMinutes: readCount(problems, name, 'ironman minutes', entry.ironmanMinutes),
        waitMinutes: readCount(problems, name, 'wait minutes', entry.waitMinutes),
        ironmanWaitMinutes: readCount(
          problems,
          name,
          'ironman wait minutes',
          entry.ironmanWaitMinutes,
        ),
      },
      guide: {
        main: guidePlace(problems, `${name} main guide`, entry.guide?.main),
        ironman: guidePlace(problems, `${name} ironman guide`, entry.guide?.ironman),
      },
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

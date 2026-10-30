import type {
  ComputedRateKind,
  Intensity,
  Method,
  MethodAudience,
  MethodCost,
  RateBand,
} from '../types/method'
import type { SkillKey } from '../types/skill'
import { parseRequirements, requirementProblems } from '../domain/requirements'
import { DataSourceError } from './sources'
import type { MethodSource } from './sources'

const INTENSITIES: readonly string[] = ['afk', 'semi', 'active'] satisfies Intensity[]
const COSTS: readonly string[] = ['profit', 'free', 'cheap', 'pricey'] satisfies MethodCost[]
const AUDIENCES: readonly string[] = ['both', 'main', 'iron'] satisfies MethodAudience[]
const COMPUTED_RATES: readonly string[] = [
  'crab-melee',
  'crab-ranged',
  'rock-magic',
  'frost-magic',
  'gem-magic',
] satisfies ComputedRateKind[]

const isIntensity = (value: string): value is Intensity => INTENSITIES.includes(value)
const isCost = (value: string): value is MethodCost => COSTS.includes(value)
const isAudience = (value: string): value is MethodAudience => AUDIENCES.includes(value)
const isComputedRate = (value: string): value is ComputedRateKind => COMPUTED_RATES.includes(value)

/** A timed run's rate is XP per hour of time spent on the run, which really is in the millions. */
const HIGHEST_RUN_RATE = 20_000_000
const HIGHEST_RATE = 2_000_000

/** '(1.5-tick)' or '(3-tick)' at the end of a name marks a tick-perfect method. */
const TICK_METHOD_NAME = /\d(\.\d)?-tick\)/
/** Level 1 entries about quest rewards, the museum quiz or Daddy's Home are advice, not grinds. */
const QUEST_SKIP_NAME = /quest|quiz|Daddy's Home/i

/** WikiSync and the quest list call the miniquest plain 'Vale Totems'. */
const normaliseRequirementText = (text: string): string =>
  text.replace('Vale Totems (miniquest)', 'Vale Totems')

function buildRateBands(source: MethodSource, where: string, problems: string[]): RateBand[] {
  const bands: RateBand[] = []
  for (const [fromLevel, xpPerHour] of source.bands ?? []) {
    if (fromLevel === undefined || xpPerHour === undefined) {
      problems.push(`${where}: a band needs a level and a rate`)
      continue
    }
    bands.push({ fromLevel: Math.trunc(fromLevel), xpPerHour: Math.trunc(xpPerHour) })
  }
  const first = bands[0]
  const ascending = bands.every(
    (band, index) => index === 0 || band.fromLevel > (bands[index - 1]?.fromLevel ?? 0),
  )
  if (first && (first.fromLevel !== source.lv || !ascending)) {
    problems.push(`${where}: bands must start at the method level and ascend`)
  }
  return bands
}

function buildMethod(skill: SkillKey, source: MethodSource, problems: string[]): Method | null {
  const where = `${skill} / ${source.name}`
  const { lv: level, int: intensity, cost, who: audience } = source

  if (!Number.isInteger(level) || level < 1 || level > 99) problems.push(`${where}: level ${level}`)
  if (!isIntensity(intensity)) problems.push(`${where}: intensity '${intensity}'`)
  if (!isCost(cost)) problems.push(`${where}: cost '${cost}'`)
  if (!isAudience(audience)) problems.push(`${where}: who '${audience}'`)
  const highestRate = source.run ? HIGHEST_RUN_RATE : HIGHEST_RATE
  if (!(source.xph >= 0 && source.xph <= highestRate)) {
    problems.push(`${where}: xp/h ${source.xph}`)
  }
  if (!source.src) problems.push(`${where}: no source page`)
  if (source.calc !== undefined && !isComputedRate(source.calc)) {
    problems.push(`${where}: unknown calc '${source.calc}'`)
  }

  const requirementText = normaliseRequirementText(source.req)
  for (const problem of requirementProblems(requirementText)) problems.push(`${where}: ${problem}`)

  const bands = buildRateBands(source, where, problems)

  if (!isIntensity(intensity) || !isCost(cost) || !isAudience(audience)) return null
  if (source.calc !== undefined && !isComputedRate(source.calc)) return null

  return {
    skill,
    level,
    name: source.name.trim(),
    // a banded method's rate at its own level is the first band, whatever `xph` says
    xpPerHour: bands[0]?.xpPerHour ?? Math.trunc(source.xph),
    intensity,
    cost,
    requirements: parseRequirements(requirementText),
    note: source.note.replace(/\s+/g, ' ').trim(),
    source: source.src,
    audience,
    ...(source.run && {
      timedRun: {
        xpPerRun: Math.trunc(source.per ?? 0),
        everyMinutes: Math.trunc(source.every ?? 0),
      },
    }),
    usesOwnSupplies: source.supply,
    tickPerfect:
      TICK_METHOD_NAME.test(source.name) || source.note.toLowerCase().startsWith('tick-perfect'),
    questSkip: level === 1 && QUEST_SKIP_NAME.test(source.name),
    perTripSetup: source.setup === true,
    inWilderness: source.wild === true,
    // one band says nothing the flat rate does not
    ...(bands.length > 1 && { rateBands: bands }),
    ...(source.calc !== undefined && { computedRate: source.calc }),
    ...(source.over && source.over.length > 0 && { preferredOver: source.over }),
  }
}

/** The best rate a method ever reaches, which decides its place among methods of the same level. */
function peakXpPerHour(method: Method): number {
  return Math.max(method.xpPerHour, ...(method.rateBands ?? []).map((band) => band.xpPerHour))
}

/**
 * Turns one skill's source entries into methods, lowest level first and, within a level, the
 * fastest first. Entries that tie keep the order of the source file. That order is what every
 * method list in the app shows, and the planner breaks ties with it.
 * Throws a DataSourceError listing everything wrong with the source.
 */
export function buildMethods(skill: SkillKey, sources: readonly MethodSource[]): Method[] {
  const problems: string[] = []
  const methods: Method[] = []
  for (const source of sources) {
    const method = buildMethod(skill, source, problems)
    if (method) methods.push(method)
  }
  if (problems.length) throw new DataSourceError(problems)
  return methods.sort(
    (first, second) => first.level - second.level || peakXpPerHour(second) - peakXpPerHour(first),
  )
}

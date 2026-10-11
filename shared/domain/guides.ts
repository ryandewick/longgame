import type { Intensity, Method, MethodAudience } from '../types/method'
import type { Requirements } from '../types/requirement'
import type { SkillKey } from '../types/skill'
import { METHODS } from '../data/methods'
import { SKILL_KEYS, skillName } from '../data/skills'
import { formatShortNumber } from './format'
import { describeMissingRequirement } from './requirements'

/*
 * The training guides: a page of methods for each skill, a page of every AFK method, and the
 * index of them all. Everything a guide says is worked out here from the method data, as plain
 * text, so the pages, the files written for search engines and AI assistants, and the tests all
 * read the same words. Nothing here knows about an account: a guide is the same for everyone.
 */

const WIKI_PAGE_URL = 'https://oldschool.runescape.wiki/w/'

/** A search result shows about this much of a description before cutting it off. */
const DESCRIPTION_LIMIT = 158

/** Every address ends in a slash: that is how a static host serves a page kept as a folder's index. */
export const GUIDES_PATH = '/guides/'
export const AFK_GUIDE_PATH = '/guides/afk/'

/** Where a skill's guide lives: '/guides/mining/'. */
export function guidePath(skill: SkillKey): string {
  return `/guides/${skill}/`
}

/**
 * The skills that have a guide, in alphabetical order: every skill with methods of its own.
 * Hitpoints has none, because it trains itself through combat.
 */
export const GUIDE_SKILLS: readonly SkillKey[] = SKILL_KEYS.filter(
  (skill) => METHODS[skill].length > 0,
).sort()

/** Is this string the key of a skill that has a guide? */
export function isGuideSkill(value: string): value is SkillKey {
  return GUIDE_SKILLS.some((skill) => skill === value)
}

/** Who a method is for, as a guide says it. */
export const AUDIENCE_LABELS: Readonly<Record<MethodAudience, string>> = {
  both: 'Everyone',
  main: 'Mains',
  iron: 'Ironmen',
}

/** One row of a guide's table: a method with everything about it already put into words. */
export interface GuideMethod {
  readonly skill: SkillKey
  readonly level: number
  readonly name: string
  readonly note: string
  /** Done on a timer (a herb run) rather than ground by the hour. */
  readonly isTimedRun: boolean
  /** '≈ 34k to 93k an hour', '≈ 12k a run', 'depends on your levels' or 'no hourly rate'. */
  readonly rate: string
  /** 'Bone Voyage, 35 Farming'; empty when the method needs nothing. */
  readonly needs: string
  readonly intensity: Intensity
  /** 'Everyone', 'Mains' or 'Ironmen'. */
  readonly audience: string
}

/** A page of the OSRS Wiki that a guide's figures came from. */
export interface WikiSource {
  readonly title: string
  readonly url: string
}

/** What every guide page has: where it lives and what it tells a search engine about itself. */
interface GuidePage {
  readonly path: string
  /** The page title, as a search result shows it. */
  readonly title: string
  /** The description a search result shows under the title. */
  readonly description: string
  /** The page's one heading. */
  readonly heading: string
  /** The sentence under the heading that says what is on the page. */
  readonly facts: string
}

export interface SkillGuide extends GuidePage {
  readonly skill: SkillKey
  /** The skill as the game writes it: 'Runecraft'. */
  readonly name: string
  /** The fastest method and the best AFK one, as sentences; empty when neither can be named. */
  readonly highlights: string
  readonly methods: readonly GuideMethod[]
  readonly sources: readonly WikiSource[]
}

export interface AfkGuide extends GuidePage {
  /** Every AFK method, skill by skill. */
  readonly methods: readonly GuideMethod[]
  readonly sources: readonly WikiSource[]
}

/** A link to a guide, as the index and the landing page list them. */
export interface GuideLink {
  readonly path: string
  readonly label: string
  /** The skill whose icon the link wears; null for the AFK page, which belongs to no skill. */
  readonly skill: SkillKey | null
  readonly methodCount: number
}

export interface GuideIndex extends GuidePage {
  /** A link for every skill, then the AFK page. */
  readonly links: readonly GuideLink[]
}

/** The best rate a method ever reaches. */
function peakXpPerHour(method: Method): number {
  return Math.max(method.xpPerHour, ...(method.rateBands ?? []).map((band) => band.xpPerHour))
}

/**
 * A method's rate in words. A timed run is counted by the run; a rate worked out from the
 * account's levels cannot be given to a reader with no account; a rate that rises with level is
 * given as its range.
 */
export function describeRate(method: Method): string {
  if (method.timedRun?.xpPerRun) return `≈ ${formatShortNumber(method.timedRun.xpPerRun)} a run`
  if (method.computedRate) return 'depends on your levels'
  const rates = [method.xpPerHour, ...(method.rateBands ?? []).map((band) => band.xpPerHour)]
  const known = rates.filter((rate) => rate > 0)
  if (!known.length) return 'no hourly rate'
  const slowest = formatShortNumber(Math.min(...known))
  const fastest = formatShortNumber(Math.max(...known))
  return slowest === fastest ? `≈ ${slowest} an hour` : `≈ ${slowest} to ${fastest} an hour`
}

/**
 * What a method needs, as a list in words: 'Bone Voyage, 35 Farming, Ardougne Medium diary'.
 * Empty when it needs nothing. A guide states this as a plain fact, where the planner would say
 * which of them the account is missing.
 */
export function describeRequirements(requirements: Requirements): string {
  const parts = [
    ...requirements.quests.map((quest) => describeMissingRequirement({ kind: 'quest', quest })),
    ...requirements.skills.map((skill) => describeMissingRequirement({ kind: 'skill', ...skill })),
    ...requirements.diaries.map((diary) => describeMissingRequirement({ kind: 'diary', diary })),
  ]
  if (requirements.combatLevel) {
    parts.push(describeMissingRequirement({ kind: 'combat', level: requirements.combatLevel }))
  }
  return parts.join(', ')
}

/** The method as a guide's table shows it. */
export function guideMethod(method: Method): GuideMethod {
  return {
    skill: method.skill,
    level: method.level,
    name: method.name,
    note: method.note,
    isTimedRun: method.timedRun !== undefined,
    rate: describeRate(method),
    needs: describeRequirements(method.requirements),
    intensity: method.intensity,
    audience: AUDIENCE_LABELS[method.audience],
  }
}

/**
 * The method with the highest peak rate among those `accepts` lets through, or null. Only a
 * method ground by the hour at a rate the wiki gives can be called fastest: timed runs and rates
 * worked out from an account's levels are left out. The earliest in the list wins a tie.
 */
export function fastestListed(
  methods: readonly Method[],
  accepts: (method: Method) => boolean = () => true,
): Method | null {
  let fastest: Method | null = null
  for (const method of methods) {
    if (!accepts(method) || method.timedRun || method.computedRate) continue
    const peak = peakXpPerHour(method)
    if (peak > 0 && (!fastest || peak > peakXpPerHour(fastest))) fastest = method
  }
  return fastest
}

/** 'Teak trees at up to about 93k XP an hour, from level 35.' */
function describePeak(method: Method): string {
  const peak = formatShortNumber(peakXpPerHour(method))
  return `${method.name} at up to about ${peak} XP an hour, from level ${method.level}.`
}

/**
 * The fastest method and the best AFK one, as sentences. When the fastest is itself AFK it is
 * only named once; when the skill has no AFK method at all, the guide says so.
 */
export function describeHighlights(methods: readonly Method[]): string {
  const sentences: string[] = []
  const fastest = fastestListed(methods)
  const fastestAfk = fastestListed(methods, (method) => method.intensity === 'afk')
  if (fastest) sentences.push(`The fastest listed is ${describePeak(fastest)}`)
  if (fastestAfk && fastestAfk !== fastest) {
    sentences.push(`The best AFK option is ${describePeak(fastestAfk)}`)
  } else if (!methods.some((method) => method.intensity === 'afk')) {
    sentences.push('None of them is fully AFK.')
  }
  return sentences.join(' ')
}

/** The wiki pages these methods were adapted from, each once, in alphabetical order. */
export function wikiSources(methods: readonly Method[]): WikiSource[] {
  const titles = [...new Set(methods.map((method) => method.source))].filter(Boolean).sort()
  return titles.map((title) => ({
    title,
    url: WIKI_PAGE_URL + encodeURI(title.replaceAll(' ', '_')),
  }))
}

/** The guide to one skill. Throws for a skill that has no methods, which has no guide. */
export function buildSkillGuide(skill: SkillKey): SkillGuide {
  const methods = METHODS[skill]
  const lowestLevel = methods[0]?.level
  if (lowestLevel === undefined) throw new Error(`There is no guide for '${skill}'`)
  const name = skillName(skill)
  const description = `${name} training in OSRS: ${methods.length} methods from level ${lowestLevel} to 99 with XP rates, AFK options, requirements and ironman routes.`
  return {
    skill,
    name,
    path: guidePath(skill),
    title: `OSRS ${name} training methods 1-99: XP rates for mains and ironmen | Long Game`,
    description: description.slice(0, DESCRIPTION_LIMIT),
    heading: `${name} training methods, level 1 to 99`,
    facts: `${methods.length} ways to train ${name} in Old School RuneScape, from level ${lowestLevel} to 99, with the XP an hour the wiki gives for each, how much attention it takes and what it needs.`,
    highlights: describeHighlights(methods),
    methods: methods.map(guideMethod),
    sources: wikiSources(methods),
  }
}

/** Every skill's guide, in the order of `GUIDE_SKILLS`. */
export function buildSkillGuides(): SkillGuide[] {
  return GUIDE_SKILLS.map(buildSkillGuide)
}

/** The page of every AFK method across all skills. */
export function buildAfkGuide(): AfkGuide {
  const methods = GUIDE_SKILLS.flatMap((skill) =>
    METHODS[skill].filter((method) => method.intensity === 'afk'),
  )
  const skillCount = new Set(methods.map((method) => method.skill)).size
  return {
    path: AFK_GUIDE_PATH,
    title: 'OSRS AFK training methods for every skill | Long Game',
    description: `Every AFK training method in Old School RuneScape, skill by skill: ${methods.length} methods with levels, XP rates and requirements.`,
    heading: 'AFK training methods for every skill',
    facts: `${methods.length} methods across ${skillCount} skills that need a click every few minutes at most, with the level each one opens at and the XP an hour the wiki gives.`,
    methods: methods.map(guideMethod),
    sources: wikiSources(methods),
  }
}

/** A link to every skill's guide, then to the AFK page: what the index and the landing page list. */
export function buildGuideLinks(): GuideLink[] {
  const afkMethodCount = GUIDE_SKILLS.reduce(
    (count, skill) => count + METHODS[skill].filter((method) => method.intensity === 'afk').length,
    0,
  )
  return [
    ...GUIDE_SKILLS.map((skill) => ({
      path: guidePath(skill),
      label: skillName(skill),
      skill,
      methodCount: METHODS[skill].length,
    })),
    { path: AFK_GUIDE_PATH, label: 'Every AFK method', skill: null, methodCount: afkMethodCount },
  ]
}

/** How many methods the guides hold between them. */
export function guideMethodCount(): number {
  return GUIDE_SKILLS.reduce((count, skill) => count + METHODS[skill].length, 0)
}

/** The index of the guides. */
export function buildGuideIndex(): GuideIndex {
  const methodCount = guideMethodCount()
  const skillCount = GUIDE_SKILLS.length
  return {
    path: GUIDES_PATH,
    title: 'OSRS training guides: every method for every skill | Long Game',
    description: `Training methods for all ${skillCount} trainable skills in Old School RuneScape: ${methodCount} methods with levels, XP rates, AFK options and ironman routes.`,
    heading: 'Training methods for every skill',
    facts: `${methodCount} methods across ${skillCount} skills, each with the level it opens at, the XP an hour the wiki gives, how much attention it takes and what it needs. Hitpoints trains itself through combat.`,
    links: buildGuideLinks(),
  }
}

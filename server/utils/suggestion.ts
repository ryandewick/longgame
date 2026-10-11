import type { GitHubIssue } from './github'
import type { JsonRecord } from './json'
import { failure, success, type Result } from './result'

/**
 * The skills a method can be suggested for. Hitpoints is left out on purpose: it is only ever trained through
 * combat, so it has no methods of its own.
 */
export const SUGGESTION_SKILLS = [
  'attack',
  'defence',
  'strength',
  'ranged',
  'prayer',
  'magic',
  'cooking',
  'woodcutting',
  'fletching',
  'fishing',
  'firemaking',
  'crafting',
  'smithing',
  'mining',
  'herblore',
  'agility',
  'thieving',
  'slayer',
  'farming',
  'runecraft',
  'hunter',
  'construction',
  'sailing',
] as const

const INTENSITY_LABELS = { afk: 'AFK', semi: 'Semi-AFK', active: 'Active' } as const
const AUDIENCE_LABELS = {
  both: 'Mains and ironmen',
  main: 'Mains only',
  iron: 'Ironmen only',
} as const

const NAME_MAXIMUM_LENGTH = 80
const NAME_MINIMUM_LENGTH = 3
const NOTES_MAXIMUM_LENGTH = 600
const XP_PER_HOUR_MAXIMUM = 2_000_000
/** Only a page on the wiki counts as a source, and nothing in the link may be able to break out of the issue text. */
const WIKI_LINK_PATTERN = /^https:\/\/oldschool\.runescape\.wiki\/[^\s<>"'`]{1,180}$/
/** Built from its code point so the invisible character itself never sits in this file. */
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b)

export type SuggestionSkill = (typeof SUGGESTION_SKILLS)[number]
export type SuggestionIntensity = keyof typeof INTENSITY_LABELS
export type SuggestionAudience = keyof typeof AUDIENCE_LABELS

/** A method suggestion that has passed every check and is safe to put in a GitHub issue. */
export interface Suggestion {
  skill: SuggestionSkill
  level: number
  name: string
  /** 0 when the player did not give a rate. */
  xpPerHour: number
  intensity: SuggestionIntensity
  audience: SuggestionAudience
  wiki: string
  /** Empty when the player wrote none. */
  notes: string
}

/**
 * Makes text a player typed safe to sit in a GitHub issue: no control characters, no markup, no mentions.
 *
 * Angle brackets and backticks become apostrophes so nothing renders as HTML or code. A zero-width space after
 * every @ stops GitHub from notifying whoever is named. Runs of white space (including line breaks) collapse to one
 * space, and the result is cut to `maximumLength`.
 */
export function sanitiseText(input: unknown, maximumLength: number): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/\p{Cc}/gu, ' ')
    .replace(/[<>`]/g, "'")
    .replace(/@/g, '@' + ZERO_WIDTH_SPACE)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)
}

/**
 * Whether the hidden `website` field was filled in. People never see that field, so only a bot fills it. The route
 * answers such a request as if it had worked, so the bot learns nothing.
 */
export function isHoneypotFilled(body: JsonRecord): boolean {
  return Boolean(body.website)
}

/** Reads a number from a form value, which arrives as text. Anything that is not a number gives NaN. */
function numberFrom(input: unknown): number {
  if (typeof input === 'number') return input
  if (typeof input === 'string' && input.trim() !== '') return Number(input)
  return Number.NaN
}

function isBlank(input: unknown): boolean {
  return input === undefined || input === null || input === ''
}

/** Whether `input` is one of the object's own keys. (`in` would also accept inherited ones like 'constructor'.) */
function isOwnKey<Labels extends object>(labels: Labels, input: unknown): input is keyof Labels {
  return typeof input === 'string' && Object.hasOwn(labels, input)
}

function isSuggestionSkill(input: unknown): input is SuggestionSkill {
  return SUGGESTION_SKILLS.some((skill) => skill === input)
}

/**
 * Checks a suggestion sent from the form and returns it cleaned. The checks stop at the first thing the player needs
 * to fix, so they are shown one clear message at a time.
 */
export function parseSuggestion(body: JsonRecord): Result<Suggestion> {
  const { skill, intensity, audience } = body
  const level = numberFrom(body.level)
  // the rate is optional: the wiki does not give one for every method
  const xpPerHour = isBlank(body.xpPerHour) ? 0 : numberFrom(body.xpPerHour)
  const name = sanitiseText(body.name, NAME_MAXIMUM_LENGTH)
  const notes = sanitiseText(body.notes, NOTES_MAXIMUM_LENGTH)
  const wiki = typeof body.wiki === 'string' ? body.wiki.trim() : ''

  if (!isSuggestionSkill(skill)) return failure(400, 'Pick a skill.')
  if (!Number.isInteger(level) || level < 1 || level > 99) {
    return failure(400, 'The level has to be between 1 and 99.')
  }
  if (name.length < NAME_MINIMUM_LENGTH) return failure(400, 'Give the method a name.')
  if (!Number.isFinite(xpPerHour) || xpPerHour < 0 || xpPerHour > XP_PER_HOUR_MAXIMUM) {
    return failure(400, 'That XP an hour does not look right.')
  }
  if (!isOwnKey(INTENSITY_LABELS, intensity) || !isOwnKey(AUDIENCE_LABELS, audience)) {
    return failure(400, 'Something in the form is missing.')
  }
  if (!WIKI_LINK_PATTERN.test(wiki)) {
    return failure(400, 'Add a link to the method on the Old School RuneScape Wiki.')
  }
  return success({ skill, level, name, xpPerHour, intensity, audience, wiki, notes })
}

/** Writes the GitHub issue for a checked suggestion. */
export function buildSuggestionIssue(suggestion: Suggestion): GitHubIssue {
  const { skill, level, name, xpPerHour, intensity, audience, wiki, notes } = suggestion
  const skillTitle = skill.charAt(0).toUpperCase() + skill.slice(1)
  const rate = xpPerHour > 0 ? Math.round(xpPerHour).toLocaleString('en-GB') : 'not given'
  return {
    title: `[Method] ${skillTitle} ${level}: ${name}`,
    body: [
      `**Skill:** ${skill}`,
      `**Level:** ${level}`,
      `**Method:** ${name}`,
      `**XP an hour:** ${rate}`,
      `**Attention:** ${INTENSITY_LABELS[intensity]}`,
      `**Works for:** ${AUDIENCE_LABELS[audience]}`,
      `**Wiki:** ${wiki}`,
      '',
      `**Notes:** ${notes || 'none'}`,
      '',
      '_Sent from the suggestion form. Check it against the wiki before adding it to datasrc._',
    ].join('\n'),
    labels: ['method suggestion'],
  }
}

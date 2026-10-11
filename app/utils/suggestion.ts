import type { Intensity, MethodAudience } from '#shared/types/method'
import type { SkillKey } from '#shared/types/skill'
import { SKILLS } from '#shared/data/skills'

/**
 * The suggestion form as the player is filling it in. The field names are the ones
 * POST /api/suggestions reads (server/utils/suggestion.ts), so the draft is sent as it is.
 */
export interface SuggestionDraft {
  /** Empty until the player picks one, when the form was opened from a list that spans skills. */
  skill: SkillKey | ''
  /** A number box holds a number, or nothing yet. */
  level: number | ''
  name: string
  /** Optional: the wiki does not give a rate for every method. */
  xpPerHour: number | ''
  intensity: Intensity
  audience: MethodAudience
  wiki: string
  notes: string
  /** The honeypot: a field no person sees, so only a bot fills it. The server drops what does. */
  website: string
}

/** The skills a method can be suggested for: every one that has methods of its own, in hiscores order. */
export const SUGGESTABLE_SKILLS: readonly SkillKey[] = SKILLS.filter(
  (definition) => !definition.passive,
).map((definition) => definition.key)

/**
 * An empty form for a method of `skill`. A skill that takes no suggestions gives the first that
 * does; no skill at all leaves the choice to the player.
 */
export function blankSuggestion(skill: SkillKey | null): SuggestionDraft {
  const picked = skill && !SUGGESTABLE_SKILLS.includes(skill) ? SUGGESTABLE_SKILLS[0] : skill
  return {
    skill: picked ?? '',
    level: '',
    name: '',
    xpPerHour: '',
    intensity: 'afk',
    audience: 'both',
    wiki: '',
    notes: '',
    website: '',
  }
}

/**
 * What the wiki link has to look like, as the `pattern` of its box: a page on the Old School
 * RuneScape Wiki. The server checks it again, more strictly.
 */
export const SUGGESTION_WIKI_PATTERN = String.raw`https://oldschool\.runescape\.wiki/.+`

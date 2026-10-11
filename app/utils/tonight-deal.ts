import type { Account } from '#shared/types/account'
import type { Intensity } from '#shared/types/method'
import type { Mood } from '#shared/types/session'
import type { SkillKey } from '#shared/types/skill'
import { SKILL_KEYS } from '#shared/data/skills'
import { INTENSITY_LABELS } from '#shared/domain/format'
import {
  SHORTEST_SESSION_WITH_WILDCARD,
  skillsInPlay,
  skillsWithMethod,
} from '#shared/domain/planner'

/*
 * What the deal panel on Tonight says before a session is dealt, and what the app says when a
 * deal or a swap could not give the player what they asked for. The rules are the planner's
 * (shared/domain/planner.ts); these put them into words.
 */

/** A mood that allows one intensity only. */
type StrictMood = Exclude<Mood, 'balanced'>

/** How a strict mood's intensity reads in the middle of a sentence. */
const STRICT_MOOD_WORDS: Readonly<Record<StrictMood, string>> = { afk: 'AFK', active: 'active' }

/** The session lengths on offer, in minutes. */
export const SESSION_LENGTHS: readonly number[] = [30, 60, 90, 120, 180, 240]

/** A session length as its chip says it: '30 min', '1.5 h'. */
export function sessionLengthLabel(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`
}

/** The moods on offer, as their chips say them. */
export const MOOD_OPTIONS: readonly { readonly value: Mood; readonly label: string }[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'afk', label: 'AFK tonight' },
  { value: 'active', label: 'Full attention' },
]

/** What a mood does to the session, for the help line under the mood chips. */
export function moodHelp(mood: Mood): string {
  if (mood === 'afk') return 'Every block is an AFK method.'
  if (mood === 'active') return 'Every block is an active method.'
  return 'Alternates AFK and active blocks.'
}

/**
 * Which skills could tonight's deal choose from? A strict mood only has the skills with a method
 * of its intensity; a balanced one has every skill with anything to grind.
 */
export function skillsForMood(account: Account, mood: Mood): SkillKey[] {
  return mood === 'balanced' ? skillsInPlay(account) : skillsWithMethod(account, [mood])
}

/**
 * The capes fanned on the deal panel: the three highest of the skills the deal chooses from,
 * highest first. When the mood leaves nothing to choose from, the account's three highest.
 */
export function capesToFan(account: Account, dealable: readonly SkillKey[]): SkillKey[] {
  const candidates = dealable.length ? dealable : SKILL_KEYS
  return [...candidates]
    .sort((first, second) => account.skills[second].level - account.skills[first].level)
    .slice(0, 3)
}

/** What the next deal will be made of. */
export interface DealOutlook {
  /** How many skills the deal has to choose from: `skillsForMood(...).length`. */
  readonly skillCount: number
  readonly mood: Mood
  readonly minutes: number
  readonly includeResets: boolean
  readonly includeWildcard: boolean
}

/** The line beside the deal button: '21 skills in play, resets included, one wildcard'. */
export function dealSummary(outlook: DealOutlook): string {
  const { skillCount, mood, minutes } = outlook
  const skills =
    mood === 'balanced'
      ? `${skillCount} skills in play`
      : `${skillCount} skills with an ${STRICT_MOOD_WORDS[mood]} method`
  const resets = outlook.includeResets ? 'resets included' : 'resets off'
  return `${skills}, ${resets}, ${wildcardOutlook(outlook.includeWildcard, mood, minutes)}`
}

/** Whether the deal will end on a wildcard and, if not, why not. Follows the planner's own conditions. */
function wildcardOutlook(includeWildcard: boolean, mood: Mood, minutes: number): string {
  if (!includeWildcard) return 'no wildcard'
  if (mood === 'afk') return 'no wildcard on an AFK night'
  if (minutes >= SHORTEST_SESSION_WITH_WILDCARD) return 'one wildcard'
  return `wildcard from ${SHORTEST_SESSION_WITH_WILDCARD} min up`
}

/**
 * The toast after a deal that could not keep to a strict mood and mixed other blocks in. Null
 * for a balanced mood, which mixes anyway.
 */
export function moodRelaxedMessage(mood: Mood): string | null {
  if (mood === 'balanced') return null
  return `Nothing ${STRICT_MOOD_WORDS[mood]} is open to this account yet, so this session mixes in other blocks.`
}

/**
 * The toast when a block has nothing to be swapped for. `wanted` is the intensities the block's
 * slot was dealt for; when it is a single one the message names it.
 */
export function nothingToSwapMessage(wanted: readonly Intensity[]): string {
  const [only, ...others] = wanted
  if (!only || others.length) return 'Nothing else to swap in.'
  // "active" sits mid-sentence in lower case; "AFK" and "Semi-AFK" keep their capitals
  const word = only === 'active' ? STRICT_MOOD_WORDS.active : INTENSITY_LABELS[only]
  return `Nothing else ${word} to swap in.`
}

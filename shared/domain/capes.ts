import type { SkillKey, SkillStat } from '../types/skill'
import { SKILL_KEYS } from '../data/skills'
import { MAX_LEVEL } from './xp'

/** A skillcape's two colours as hex strings ('#6e1e16'). */
export interface CapeColours {
  /** The body of the cape. */
  readonly cape: string
  /** The band along its edge. */
  readonly trim: string
}

/**
 * Each skillcape's colour and trim, sampled from the game's own cape art. A skill wears its cape
 * wherever it appears, and no colour in the interface is given to anything but a skill.
 */
export const CAPE_COLOURS: Readonly<Record<SkillKey, CapeColours>> = {
  attack: { cape: '#6e1e16', trim: '#cdb418' },
  defence: { cape: '#687bb7', trim: '#9f9b7e' },
  strength: { cape: '#0b6944', trim: '#931e10' },
  hitpoints: { cape: '#a5a4a1', trim: '#9e2114' },
  ranged: { cape: '#546a1f', trim: '#8b5833' },
  prayer: { cape: '#cdc5c5', trim: '#ceb41e' },
  magic: { cape: '#988c78', trim: '#3f4191' },
  cooking: { cape: '#52245e', trim: '#78190d' },
  woodcutting: { cape: '#887143', trim: '#2e6741' },
  fletching: { cape: '#194c4e', trim: '#b17915' },
  fishing: { cape: '#839fb8', trim: '#b17915' },
  firemaking: { cape: '#bb6b1a', trim: '#d0b719' },
  crafting: { cape: '#775d46', trim: '#cfb519' },
  smithing: { cape: '#565546', trim: '#b17915' },
  mining: { cape: '#595847', trim: '#649ab0' },
  herblore: { cape: '#0a600d', trim: '#c6ae18' },
  agility: { cape: '#34356e', trim: '#84322b' },
  thieving: { cape: '#6e445f', trim: '#3d3838' },
  slayer: { cape: '#2a2526', trim: '#8e1c10' },
  farming: { cape: '#2d582e', trim: '#8fa65e' },
  runecraft: { cape: '#a3a398', trim: '#cdb418' },
  hunter: { cape: '#696347', trim: '#3a352c' },
  construction: { cape: '#948a77', trim: '#a57524' },
  sailing: { cape: '#2c597b', trim: '#715240' },
}

/** What a block with no skill wears (a wildcard, a daily shop): a plain dark field with a brass trim. */
export const PLAIN_CAPE: CapeColours = { cape: '#2c241d', trim: '#b08a45' }

/** The page's ground colour (`--color-ground`), which a thin line of cape colour has to show against. */
export const GROUND_COLOUR = '#191411'

const WHITE = '#ffffff'

/** The least contrast against the ground at which a thin line of colour still reads. */
const READABLE_CONTRAST = 3

/** Each step towards readable mixes in this share of white, and there are at most this many. */
const LIGHTEN_SHARE = 0.1
const LIGHTEN_STEPS_MAXIMUM = 14

/** A cape darker than this with channels closer together than this has no colour of its own to show. */
const COLOURLESS_LUMINANCE = 0.05
const COLOURLESS_CHANNEL_SPREAD = 24

/** The colours a skill wears, or the plain cape when there is no skill. */
export function capeColours(skill: SkillKey | null): CapeColours {
  return skill ? CAPE_COLOURS[skill] : PLAIN_CAPE
}

/** The red, green and blue of a '#rrggbb' colour, each 0 to 255. */
function channels(colour: string): [number, number, number] {
  const value = Number.parseInt(colour.slice(1), 16)
  return [value >> 16, (value >> 8) & 255, value & 255]
}

/** How light a colour is, 0 (black) to 1 (white): relative luminance as WCAG defines it. */
export function relativeLuminance(colour: string): number {
  const [red, green, blue] = channels(colour).map((channel) => {
    const share = channel / 255
    return share <= 0.03928 ? share / 12.92 : Math.pow((share + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** The WCAG contrast ratio between two colours, 1 (the same) to 21 (black on white). */
export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

/** A colour part of the way from one to another: `share` 0 gives `from`, 1 gives `to`. */
export function mixColours(from: string, to: string, share: number): string {
  const target = channels(to)
  const mixed = channels(from).map((channel, index) =>
    Math.round(channel * (1 - share) + (target[index] ?? 0) * share),
  )
  return '#' + mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')
}

/**
 * A skill's colour for a thin line on the dark ground (an XP bar's fill, a skill strip): the
 * cape's own hue, lightened a step at a time until it reads. Only a dark cape with almost no
 * colour in it (Slayer's black) falls back to its trim.
 */
export function readableCapeColour(skill: SkillKey | null): string {
  const { cape, trim } = capeColours(skill)
  const capeChannels = channels(cape)
  const isColourless =
    Math.max(...capeChannels) - Math.min(...capeChannels) < COLOURLESS_CHANNEL_SPREAD &&
    relativeLuminance(cape) < COLOURLESS_LUMINANCE
  let colour = isColourless ? trim : cape
  for (
    let step = 0;
    step < LIGHTEN_STEPS_MAXIMUM && contrastRatio(colour, GROUND_COLOUR) < READABLE_CONTRAST;
    step++
  ) {
    colour = mixColours(colour, WHITE, LIGHTEN_SHARE)
  }
  return colour
}

/**
 * How much of a cape is in colour at this level, 0 to 100: levels 1 to 99 mapped evenly, so a
 * cape fills from the hem as the skill climbs. The same scale places a level on a skill strip.
 */
export function capeFillPercent(level: number): number {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, level))
  return ((clamped - 1) / (MAX_LEVEL - 1)) * 100
}

/**
 * How much of a cape's fill was already there when the skill was at a lower level, from 0 (none
 * of it) to 1 (all of it: nothing has been added). Where the colour starts from when a cape is
 * shown filling from an earlier level up to this one.
 */
export function fillShareAtLevel(earlierLevel: number, level: number): number {
  const fill = capeFillPercent(level)
  if (fill <= 0) return 1
  return Math.min(1, capeFillPercent(earlierLevel) / fill)
}

/**
 * The order capes hang on the rack: lowest level first and, within a level, least XP first, so
 * the rail reads as progress from left to right. Ties keep the hiscores order.
 */
export function rackOrder(skills: Readonly<Record<SkillKey, SkillStat>>): SkillKey[] {
  return [...SKILL_KEYS].sort(
    (first, second) =>
      skills[first].level - skills[second].level || skills[first].xp - skills[second].xp,
  )
}

import type { SkillKey, SkillStat } from '#shared/types/skill'
import { capeFillPercent } from '#shared/domain/capes'
import type { MaxProgress } from '#shared/domain/estimates'
import { formatNumber } from '#shared/domain/format'
import { MAX_LEVEL } from '#shared/domain/xp'
import { formatLongHours } from './format'

/*
 * "Share my rack": the account's rack as a 1200 by 630 picture, the size link previews use.
 * The same rules as the rack on the page: lowest level first, each cape greyed and then coloured
 * up to its level, the max cape at the end.
 *
 * This module is the layout: where everything goes, how full each cape is and what every line
 * says, as plain data. utils/draw-rack-picture.ts puts it on a canvas. Text that follows other
 * text on its line is given as a run with a gap, because only the canvas can measure a string.
 */

export const RACK_PICTURE_WIDTH = 1200
export const RACK_PICTURE_HEIGHT = 630

/**
 * The picture's colours. A canvas cannot read the page's custom properties, so each of these
 * repeats the value of the token named beside it in assets/styles/tokens.scss (a test holds
 * them to it).
 */
export const RACK_PICTURE_PALETTE = {
  /** --color-stage */
  stage: '#100d0b',
  /** --color-stage-glow */
  stageGlow: '#3a2a1f',
  /** --color-stage-falloff */
  stageFalloff: '#1b1411',
  /** --color-stat */
  stat: '#ffff00',
  /** --color-text-strong */
  textStrong: '#fff',
  /** --color-text */
  text: '#f0e2c4',
  /** --color-text-muted */
  textMuted: '#b9ab92',
  /** --color-text-faint */
  textFaint: '#9a8d78',
  /** --color-brass-light */
  brassLight: '#d9b56a',
  /** --color-brass */
  brass: '#b08a45',
  /** --color-brass-dark */
  brassDark: '#6f5425',
  /** --color-black: the hard shadow under the game's numbers */
  black: '#000',
  /** the colour inside --shadow-rail */
  railShadow: 'rgb(0 0 0 / 60%)',
} as const

/** The type the picture is set in, as canvas font shorthands. The families are the tokens' own. */
const FONTS = {
  wordmark: '800 40px Poppins, Figtree, sans-serif',
  name: '700 26px Figtree, sans-serif',
  totalLevel: '500 19px Figtree, sans-serif',
  count: '64px RSB, RS, sans-serif',
  countNoun: '800 38px Figtree, sans-serif',
  summary: '500 21px Figtree, sans-serif',
  level: '16px RS, sans-serif',
  site: '600 19px Figtree, sans-serif',
  disclaimer: '500 16px Figtree, sans-serif',
} as const

/** The margin kept clear down both sides. */
const MARGIN = 48

/** The wordmark is 40px Poppins: each 9 drops 0.215em to sit like a g, and letters close up 0.045em. */
const WORDMARK = { x: 48, baseline: 82, nineDrop: 8.6, tracking: -1.8, wordGap: 11 } as const

/** The top of the brass rail. The capes hang from a little above it. */
const RAIL_TOP = 296
const RAIL = { x: 24, height: 8, shadowOffset: 2 } as const
const CAPES_TOP = RAIL_TOP - 7

/** A skillcape render is 320 by 622; the max cape's is 320 by 620. */
const CAPE = { width: 92, height: Math.round((92 * 622) / 320) } as const
const MAX_CAPE = { width: 96, height: Math.round((96 * 620) / 320) } as const

/** The skillcapes share this much width from this left edge, overlapping like clothes on a rack. */
const CAPES = { left: 44, span: 956 } as const

/** How far below the foot of a skillcape its level is written. */
const LEVEL_BELOW_CAPE = 32

/** The baseline of the line at the foot of the picture. */
const FOOTER_BASELINE = RACK_PICTURE_HEIGHT - 42

/** One run of text in one font and colour. */
export interface PictureRun {
  readonly text: string
  /** A canvas font shorthand: '700 26px Figtree, sans-serif'. */
  readonly font: string
  readonly colour: string
  /** The game's hard shadow: the text again in black, this many pixels down and right. 0 for none. */
  readonly shadow: number
  /** Space between the end of the run before and this one. Negative closes letters up. */
  readonly gapBefore: number
  /** How far below the line's baseline the run sits. Negative lifts it. */
  readonly drop: number
}

/**
 * A line of text. `x` is where it starts ('left'), ends ('right') or is centred ('center').
 * Only a line that starts at `x` has more than one run: each follows the one before.
 */
export interface PictureLine {
  readonly x: number
  readonly baseline: number
  readonly align: 'left' | 'right' | 'center'
  readonly runs: readonly PictureRun[]
}

/** A cape hanging on the rail. */
export interface PictureCape {
  /** Null for the max cape. */
  readonly skill: SkillKey | null
  /** Draw the trimmed cape: the one worn at 99. */
  readonly trimmed: boolean
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** How much of the cape is in colour, from the hem up: 0 to 1. */
  readonly fill: number
}

export interface RackPictureLayout {
  readonly width: number
  readonly height: number
  /** The light falling on the stage from above: a radial glow centred off the top edge. */
  readonly glow: { readonly centreX: number; readonly centreY: number; readonly radius: number }
  readonly rail: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    /** How far below the rail its shadow falls. */
    readonly shadowOffset: number
  }
  /** The skillcapes in rack order, then the max cape. Later capes overlap earlier ones. */
  readonly capes: readonly PictureCape[]
  readonly lines: readonly PictureLine[]
}

/** What the picture needs to know about the account. */
export interface RackPictureSubject {
  readonly name: string
  readonly isIronman: boolean
  readonly totalLevel: number
  readonly skills: Readonly<Record<SkillKey, SkillStat>>
  /** The skills in the order their capes hang: lowest level first. */
  readonly rackOrder: readonly SkillKey[]
  readonly maxProgress: MaxProgress
  /** The site's address, as `runtimeConfig.public.siteUrl` has it. May be empty. */
  readonly siteUrl: string
}

function run(
  text: string,
  font: string,
  colour: string,
  placing: { shadow?: number; gapBefore?: number; drop?: number } = {},
): PictureRun {
  return {
    text,
    font,
    colour,
    shadow: placing.shadow ?? 0,
    gapBefore: placing.gapBefore ?? 0,
    drop: placing.drop ?? 0,
  }
}

/** The wordmark, a letter to a run: "long game" with both g's as dropped yellow 9s. */
function wordmarkLine(): PictureLine {
  const { stat, text } = RACK_PICTURE_PALETTE
  const runs: PictureRun[] = []
  for (const word of ['lon9', '9ame']) {
    for (const [place, letter] of [...word].entries()) {
      const isNine = letter === '9'
      const startsWord = place === 0
      const isFirstRun = runs.length === 0
      runs.push(
        run(letter, FONTS.wordmark, isNine ? stat : text, {
          gapBefore: isFirstRun ? 0 : WORDMARK.tracking + (startsWord ? WORDMARK.wordGap : 0),
          drop: isNine ? WORDMARK.nineDrop : 0,
        }),
      )
    }
  }
  return { x: WORDMARK.x, baseline: WORDMARK.baseline, align: 'left', runs }
}

/** 'longgame.tools' from 'https://longgame.tools/'; the app's name when there is no address. */
export function rackPictureSiteName(siteUrl: string): string {
  return siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Long Game'
}

/** The line under the count: what is left, or that nothing is. */
export function rackPictureSummary(maxProgress: MaxProgress): string {
  if (maxProgress.skillsMaxed === maxProgress.skillCount) return 'Maxed. Every cape is on the rail.'
  const levels = formatNumber(maxProgress.levelsLeft)
  return `${levels} levels to go, about ${formatLongHours(maxProgress.hoursLeft)} at the best methods`
}

/** What the picture says to someone who cannot see it. */
export function rackPictureDescription(name: string, maxProgress: MaxProgress): string {
  return `${name}’s skillcapes on the rail, ${maxProgress.skillsMaxed} of ${maxProgress.skillCount} at 99`
}

/** Lays the picture out for an account. */
export function rackPictureLayout(subject: RackPictureSubject): RackPictureLayout {
  const palette = RACK_PICTURE_PALETTE
  const { maxProgress, rackOrder, skills } = subject
  const rightEdge = RACK_PICTURE_WIDTH - MARGIN
  const progress = Math.max(0, Math.min(1, maxProgress.percent / 100))

  // the first cape hangs at the left edge and the last ends where the span does
  const pitch = (CAPES.span - CAPE.width) / Math.max(1, rackOrder.length - 1)
  const levelBaseline = CAPES_TOP + CAPE.height + LEVEL_BELOW_CAPE

  const capes: PictureCape[] = []
  const levelLines: PictureLine[] = []
  for (const [place, skill] of rackOrder.entries()) {
    const { level } = skills[skill]
    const x = Math.round(CAPES.left + place * pitch)
    capes.push({
      skill,
      trimmed: level >= MAX_LEVEL,
      x,
      y: CAPES_TOP,
      ...CAPE,
      fill: capeFillPercent(level) / 100,
    })
    levelLines.push({
      x: x + CAPE.width / 2,
      baseline: levelBaseline,
      align: 'center',
      runs: [run(String(level), FONTS.level, palette.stat, { shadow: 1 })],
    })
  }

  const maxCapeX = rightEdge - MAX_CAPE.width
  capes.push({
    skill: null,
    trimmed: false,
    x: maxCapeX,
    y: CAPES_TOP,
    ...MAX_CAPE,
    fill: progress,
  })

  const totalLevel = `${subject.isIronman ? 'Ironman, total level' : 'Total level'} ${formatNumber(subject.totalLevel)}`
  const lines: PictureLine[] = [
    wordmarkLine(),
    // whose rack it is
    {
      x: rightEdge,
      baseline: 68,
      align: 'right',
      runs: [run(subject.name, FONTS.name, palette.textStrong)],
    },
    {
      x: rightEdge,
      baseline: 96,
      align: 'right',
      runs: [run(totalLevel, FONTS.totalLevel, palette.textMuted)],
    },
    // the count: the word sits two pixels above the figure's baseline, as it does on the page
    {
      x: MARGIN,
      baseline: 206,
      align: 'left',
      runs: [
        run(`${maxProgress.skillsMaxed}/${maxProgress.skillCount}`, FONTS.count, palette.stat, {
          shadow: 3,
        }),
        run('capes', FONTS.countNoun, palette.textStrong, { gapBefore: 16, drop: -2 }),
      ],
    },
    {
      x: MARGIN,
      baseline: 246,
      align: 'left',
      runs: [run(rackPictureSummary(maxProgress), FONTS.summary, palette.textMuted)],
    },
    ...levelLines,
    {
      x: maxCapeX + MAX_CAPE.width / 2,
      baseline: levelBaseline,
      align: 'center',
      runs: [run('Max cape', FONTS.level, palette.textStrong, { shadow: 1 })],
    },
    // where it came from
    {
      x: MARGIN,
      baseline: FOOTER_BASELINE,
      align: 'left',
      runs: [
        run(rackPictureSiteName(subject.siteUrl), FONTS.site, palette.text),
        run('Free OSRS maxing planner', FONTS.site, palette.textFaint, { gapBefore: 18 }),
      ],
    },
    {
      x: rightEdge,
      baseline: FOOTER_BASELINE,
      align: 'right',
      runs: [run('A fan project. Not affiliated with Jagex.', FONTS.disclaimer, palette.textFaint)],
    },
  ]

  return {
    width: RACK_PICTURE_WIDTH,
    height: RACK_PICTURE_HEIGHT,
    glow: { centreX: RACK_PICTURE_WIDTH / 2, centreY: -140, radius: 920 },
    rail: {
      x: RAIL.x,
      y: RAIL_TOP,
      width: RACK_PICTURE_WIDTH - 2 * RAIL.x,
      height: RAIL.height,
      shadowOffset: RAIL.shadowOffset,
    },
    capes,
    lines,
  }
}

/** Every font the picture is set in, each with all the text set in it: what has to load before drawing. */
export function rackPictureFonts(layout: RackPictureLayout): { font: string; text: string }[] {
  const textByFont = new Map<string, string>()
  for (const line of layout.lines) {
    for (const { font, text } of line.runs)
      textByFont.set(font, (textByFont.get(font) ?? '') + text)
  }
  return [...textByFont].map(([font, text]) => ({ font, text }))
}

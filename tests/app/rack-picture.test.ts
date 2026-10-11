import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SkillKey } from '#shared/types/skill'
import { forEverySkill, SKILL_KEYS } from '#shared/data/skills'
import { rackOrder } from '#shared/domain/capes'
import type { MaxProgress } from '#shared/domain/estimates'
import { xpForLevel } from '#shared/domain/xp'
import {
  RACK_PICTURE_HEIGHT,
  RACK_PICTURE_PALETTE,
  RACK_PICTURE_WIDTH,
  rackPictureDescription,
  rackPictureFonts,
  rackPictureLayout,
  rackPictureSiteName,
  rackPictureSummary,
  type PictureLine,
  type RackPictureSubject,
} from '~~/app/utils/rack-picture'

const progress = (overrides: Partial<MaxProgress> = {}): MaxProgress => ({
  percent: 25,
  xp: 78_000_000,
  levelsLeft: 612,
  hoursLeft: 1956.4,
  skillsMaxed: 1,
  skillCount: 24,
  ...overrides,
})

/** An account with every skill at 50 except the levels given. */
function subjectWith(
  levels: Partial<Record<SkillKey, number>> = {},
  overrides: Partial<RackPictureSubject> = {},
): RackPictureSubject {
  const skills = forEverySkill((skill) => {
    const level = levels[skill] ?? 50
    return { level, xp: xpForLevel(level) }
  })
  return {
    name: 'Zezima',
    isIronman: false,
    totalLevel: 1249,
    skills,
    rackOrder: rackOrder(skills),
    maxProgress: progress(),
    siteUrl: 'https://longgame.tools',
    ...overrides,
  }
}

const textOf = (line: PictureLine): string => line.runs.map((run) => run.text).join('')
const lineSaying = (lines: readonly PictureLine[], text: string): PictureLine | undefined =>
  lines.find((line) => textOf(line) === text)

describe('the palette', () => {
  const tokens = readFileSync(
    new URL('../../app/assets/styles/tokens.scss', import.meta.url),
    'utf8',
  )
  const token = (name: string): string | undefined =>
    new RegExp(`--${name}: ([^;]+);`).exec(tokens)?.[1]

  it('repeats the tokens it is named after', () => {
    const palette = RACK_PICTURE_PALETTE
    expect(palette.stage).toBe(token('color-stage'))
    expect(palette.stageGlow).toBe(token('color-stage-glow'))
    expect(palette.stageFalloff).toBe(token('color-stage-falloff'))
    expect(palette.stat).toBe(token('color-stat'))
    expect(palette.statUnfilled).toBe(token('color-stat-unfilled'))
    expect(palette.ink).toBe(token('color-ink'))
    expect(palette.textStrong).toBe(token('color-text-strong'))
    expect(palette.text).toBe(token('color-text'))
    expect(palette.textMuted).toBe(token('color-text-muted'))
    expect(palette.textFaint).toBe(token('color-text-faint'))
    expect(palette.brassLight).toBe(token('color-brass-light'))
    expect(palette.brass).toBe(token('color-brass'))
    expect(palette.brassDark).toBe(token('color-brass-dark'))
    expect(palette.black).toBe(token('color-black'))
    expect(token('shadow-rail')).toBe(`0 2px 0 ${palette.railShadow}`)
  })
})

describe('rackPictureSiteName', () => {
  it('drops the scheme and a trailing slash', () => {
    expect(rackPictureSiteName('https://longgame.tools')).toBe('longgame.tools')
    expect(rackPictureSiteName('http://localhost:3000/')).toBe('localhost:3000')
  })

  it('falls back to the name of the app', () => {
    expect(rackPictureSiteName('')).toBe('Long Game')
  })
})

describe('rackPictureSummary', () => {
  it('says what is left', () => {
    expect(rackPictureSummary(progress())).toBe(
      '612 levels to go, about 1,956 hours at the best methods',
    )
  })

  it('says when nothing is', () => {
    expect(rackPictureSummary(progress({ skillsMaxed: 24, levelsLeft: 0, hoursLeft: 0 }))).toBe(
      'Maxed. Every cape is on the rail.',
    )
  })
})

describe('rackPictureDescription', () => {
  it('says whose capes they are and how many are at 99', () => {
    expect(rackPictureDescription('Zezima', progress({ skillsMaxed: 3 }))).toBe(
      'Zezima’s skillcapes on the rail, 3 of 24 at 99',
    )
  })
})

describe('rackPictureLayout', () => {
  const layout = rackPictureLayout(subjectWith({ mining: 99, agility: 1, slayer: 75 }))
  const skillcapes = layout.capes.slice(0, -1)
  const maxCape = layout.capes.at(-1)

  it('is the size link previews use', () => {
    expect([layout.width, layout.height]).toEqual([RACK_PICTURE_WIDTH, RACK_PICTURE_HEIGHT])
    expect([layout.width, layout.height]).toEqual([1200, 630])
  })

  it('hangs a cape for every skill in rack order, then the max cape', () => {
    expect(layout.capes).toHaveLength(SKILL_KEYS.length + 1)
    expect(skillcapes[0]?.skill).toBe('agility')
    expect(skillcapes.at(-2)?.skill).toBe('slayer')
    expect(skillcapes.at(-1)?.skill).toBe('mining')
    expect(maxCape?.skill).toBeNull()
  })

  it('spreads the skillcapes evenly from the left edge to the end of their span', () => {
    expect(skillcapes[0]?.x).toBe(44)
    // 956 wide from 44, less the 92 of the last cape itself
    expect(skillcapes.at(-1)?.x).toBe(44 + 956 - 92)
    const gaps = skillcapes.slice(1).map((cape, index) => cape.x - (skillcapes[index]?.x ?? 0))
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(37)
      expect(gap).toBeLessThanOrEqual(38)
    }
  })

  it('draws every skillcape the same size, hanging from just above the rail', () => {
    for (const cape of skillcapes) {
      expect([cape.width, cape.height, cape.y]).toEqual([92, 179, 289])
    }
    expect(layout.rail).toEqual({ x: 24, y: 296, width: 1152, height: 8, shadowOffset: 2 })
  })

  it('colours each cape as far as its level: nothing at 1, all of it at 99', () => {
    const fillOf = (skill: SkillKey) => layout.capes.find((cape) => cape.skill === skill)?.fill
    expect(fillOf('agility')).toBe(0)
    expect(fillOf('mining')).toBe(1)
    expect(fillOf('attack')).toBe(0.5)
    expect(fillOf('slayer')).toBeCloseTo(74 / 98)
  })

  it('counts a level above 99 as a full cape', () => {
    const boosted = rackPictureLayout(subjectWith({ mining: 120 }))
    expect(boosted.capes.find((cape) => cape.skill === 'mining')?.fill).toBe(1)
  })

  it('draws the trimmed cape for a skill at 99 and for no other', () => {
    expect(layout.capes.filter((cape) => cape.trimmed).map((cape) => cape.skill)).toEqual([
      'mining',
    ])
  })

  it('hangs the max cape against the right margin, filled as far as the XP to max', () => {
    expect(maxCape).toEqual({
      skill: null,
      trimmed: false,
      x: 1200 - 48 - 96,
      y: 289,
      width: 96,
      height: 186,
      fill: 0.25,
    })
  })

  it('fills the mark as far as the max cape, never past full or below empty', () => {
    expect(layout.mark.progress).toBe(0.25)
    const over = rackPictureLayout(subjectWith({}, { maxProgress: progress({ percent: 140 }) }))
    expect(over.mark.progress).toBe(1)
    expect(over.capes.at(-1)?.fill).toBe(1)
    const under = rackPictureLayout(subjectWith({}, { maxProgress: progress({ percent: -5 }) }))
    expect(under.mark.progress).toBe(0)
  })

  it('puts the 64 unit mark at 70% in the middle of its tile', () => {
    const { x, y, size, markX, markY, markScale } = layout.mark
    expect(markX - x).toBeCloseTo((size - 64 * markScale) / 2)
    expect(markY - y).toBeCloseTo((size - 64 * markScale) / 2)
  })

  it('writes each level centred under its cape, in the game’s yellow with its shadow', () => {
    const levelLines = layout.lines.filter(
      (line) => line.align === 'center' && /^\d+$/.test(textOf(line)),
    )
    expect(levelLines).toHaveLength(SKILL_KEYS.length)
    for (const [place, line] of levelLines.entries()) {
      const cape = skillcapes[place]
      expect(line.x).toBe((cape?.x ?? 0) + 46)
      expect(line.baseline).toBe(500)
      expect(line.runs[0]).toMatchObject({ colour: RACK_PICTURE_PALETTE.stat, shadow: 1 })
    }
    expect(levelLines.map(textOf).slice(0, 1)).toEqual(['1'])
    expect(levelLines.map(textOf).at(-1)).toBe('99')
  })

  it('labels the max cape in white on the same line as the levels', () => {
    const label = lineSaying(layout.lines, 'Max cape')
    expect(label).toMatchObject({ x: 1056 + 48, baseline: 500, align: 'center' })
    expect(label?.runs[0]).toMatchObject({ colour: RACK_PICTURE_PALETTE.textStrong, shadow: 1 })
  })

  it('spells the wordmark a letter at a time, with both 9s yellow and dropped', () => {
    const wordmark = layout.lines[0]
    expect(wordmark?.runs.map((run) => run.text).join('')).toBe('lon99ame')
    expect(wordmark).toMatchObject({ x: 120, baseline: 82, align: 'left' })
    for (const run of wordmark?.runs ?? []) {
      const isNine = run.text === '9'
      expect(run.colour).toBe(isNine ? RACK_PICTURE_PALETTE.stat : RACK_PICTURE_PALETTE.text)
      expect(run.drop).toBe(isNine ? 8.6 : 0)
    }
  })

  it('closes the wordmark’s letters up and leaves a gap between its two words', () => {
    const gaps = layout.lines[0]?.runs.map((run) => run.gapBefore)
    expect(gaps?.[0]).toBe(0)
    expect(gaps?.slice(1, 4)).toEqual([-1.8, -1.8, -1.8])
    expect(gaps?.[4]).toBeCloseTo(11 - 1.8)
    expect(gaps?.slice(5)).toEqual([-1.8, -1.8, -1.8])
  })

  it('says whose rack it is at the top right', () => {
    expect(lineSaying(layout.lines, 'Zezima')).toMatchObject({
      x: 1152,
      baseline: 68,
      align: 'right',
    })
    expect(lineSaying(layout.lines, 'Total level 1,249')).toMatchObject({
      x: 1152,
      baseline: 96,
      align: 'right',
    })
  })

  it('says so when the account is an ironman', () => {
    const ironman = rackPictureLayout(subjectWith({}, { isIronman: true, totalLevel: 2277 }))
    expect(lineSaying(ironman.lines, 'Ironman, total level 2,277')).toBeDefined()
  })

  it('sets the count in the game’s font with "capes" after it, two pixels higher', () => {
    const count = lineSaying(layout.lines, '1/24capes')
    expect(count).toMatchObject({ x: 48, baseline: 206, align: 'left' })
    expect(count?.runs[0]).toMatchObject({
      text: '1/24',
      colour: RACK_PICTURE_PALETTE.stat,
      shadow: 3,
    })
    expect(count?.runs[1]).toMatchObject({ text: 'capes', gapBefore: 16, drop: -2, shadow: 0 })
  })

  it('writes the summary under the count', () => {
    expect(
      lineSaying(layout.lines, '612 levels to go, about 1,956 hours at the best methods'),
    ).toMatchObject({ x: 48, baseline: 246, align: 'left' })
  })

  it('signs the foot with the site and what it is, and the line about Jagex', () => {
    const site = lineSaying(layout.lines, 'longgame.toolsFree OSRS maxing planner')
    expect(site).toMatchObject({ x: 48, baseline: 588, align: 'left' })
    expect(site?.runs[1]?.gapBefore).toBe(18)
    expect(lineSaying(layout.lines, 'A fan project. Not affiliated with Jagex.')).toMatchObject({
      x: 1152,
      baseline: 588,
      align: 'right',
    })
  })

  it('keeps every line that is not left aligned to a single run', () => {
    for (const line of layout.lines) {
      if (line.align !== 'left') expect(line.runs).toHaveLength(1)
    }
  })
})

describe('rackPictureFonts', () => {
  const fonts = rackPictureFonts(rackPictureLayout(subjectWith()))

  it('lists each font once', () => {
    const names = fonts.map((entry) => entry.font)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('800 40px Poppins, Figtree, sans-serif')
    expect(names).toContain('64px RSB, RS, sans-serif')
    expect(names).toContain('16px RS, sans-serif')
  })

  it('gathers all the text set in a font, so the right glyphs are loaded', () => {
    const textIn = (font: string) => fonts.find((entry) => entry.font === font)?.text
    expect(textIn('800 40px Poppins, Figtree, sans-serif')).toBe('lon99ame')
    expect(textIn('16px RS, sans-serif')).toContain('Max cape')
    expect(textIn('600 19px Figtree, sans-serif')).toBe('longgame.toolsFree OSRS maxing planner')
  })
})

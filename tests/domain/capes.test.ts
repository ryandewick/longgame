import { describe, expect, it } from 'vitest'
import type { SkillKey } from '#shared/types/skill'
import { forEverySkill, SKILL_KEYS } from '#shared/data/skills'
import {
  accountCapes,
  CAPE_COLOURS,
  capeColours,
  capeFillPercent,
  contrastRatio,
  fillShareAtLevel,
  GROUND_COLOUR,
  mixColours,
  PLAIN_CAPE,
  rackOrder,
  readableCapeColour,
  relativeLuminance,
} from '#shared/domain/capes'

describe('CAPE_COLOURS', () => {
  it('has a colour and a trim for every skill, each a six-digit hex colour', () => {
    expect(Object.keys(CAPE_COLOURS).sort()).toEqual([...SKILL_KEYS].sort())
    for (const { cape, trim } of Object.values(CAPE_COLOURS)) {
      expect(cape).toMatch(/^#[0-9a-f]{6}$/)
      expect(trim).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('capeColours', () => {
  it("gives a skill's own cape", () => {
    expect(capeColours('slayer')).toEqual({ cape: '#2a2526', trim: '#8e1c10' })
  })

  it('gives the plain cape when there is no skill', () => {
    expect(capeColours(null)).toBe(PLAIN_CAPE)
  })
})

describe('relativeLuminance and contrastRatio', () => {
  it('runs from black to white', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10)
  })

  it('gives 21 for black on white, whichever way round, and 1 for a colour on itself', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10)
    expect(contrastRatio('#887143', '#887143')).toBe(1)
  })
})

describe('mixColours', () => {
  it('moves each channel the given share of the way', () => {
    expect(mixColours('#000000', '#ffffff', 0.1)).toBe('#1a1a1a')
    expect(mixColours('#ff0000', '#0000ff', 0.5)).toBe('#800080')
  })

  it('returns either end unchanged at 0 and 1', () => {
    expect(mixColours('#0a600d', '#ffffff', 0)).toBe('#0a600d')
    expect(mixColours('#0a600d', '#ffffff', 1)).toBe('#ffffff')
  })
})

describe('readableCapeColour', () => {
  it('reads at 3:1 or better against the ground for every skill', () => {
    for (const skill of SKILL_KEYS) {
      expect(contrastRatio(readableCapeColour(skill), GROUND_COLOUR)).toBeGreaterThanOrEqual(3)
    }
  })

  it('leaves a cape alone when it already reads', () => {
    expect(readableCapeColour('defence')).toBe(CAPE_COLOURS.defence.cape)
    expect(readableCapeColour('firemaking')).toBe(CAPE_COLOURS.firemaking.cape)
  })

  it("lightens a dark cape while keeping its hue: Attack's red stays red", () => {
    expect(readableCapeColour('attack')).toBe('#965b55')
    expect(readableCapeColour('herblore')).toBe('#397e3b')
  })

  it("falls back to the trim for Slayer's black cape, which has no colour to lighten", () => {
    expect(readableCapeColour('slayer')).toBe('#a3473e')
  })

  it('gives the brass trim when there is no skill', () => {
    expect(readableCapeColour(null)).toBe(PLAIN_CAPE.trim)
  })

  // pinned so that a change to the lightening is seen for every cape, not found by eye
  it('gives every skill its readable colour', () => {
    const expected: Record<SkillKey, string> = {
      attack: '#965b55',
      defence: '#687bb7',
      strength: '#237857',
      hitpoints: '#a5a4a1',
      ranged: '#546a1f',
      prayer: '#cdc5c5',
      magic: '#988c78',
      cooking: '#81608a',
      woodcutting: '#887143',
      fletching: '#456e70',
      fishing: '#839fb8',
      firemaking: '#bb6b1a',
      crafting: '#856d59',
      smithing: '#676659',
      mining: '#6a6959',
      herblore: '#397e3b',
      agility: '#6b6b96',
      thieving: '#7d576f',
      slayer: '#a3473e',
      farming: '#557856',
      runecraft: '#a3a398',
      hunter: '#696347',
      construction: '#948a77',
      sailing: '#416a88',
    }
    expect(forEverySkill(readableCapeColour)).toEqual(expected)
  })
})

describe('capeFillPercent', () => {
  it('is empty at level 1 and full at 99', () => {
    expect(capeFillPercent(1)).toBe(0)
    expect(capeFillPercent(99)).toBe(100)
  })

  it('maps the levels between evenly', () => {
    expect(capeFillPercent(50)).toBe(50)
    expect(capeFillPercent(74)).toBeCloseTo(74.49, 2)
  })

  it('stays within the cape for levels outside 1 to 99', () => {
    expect(capeFillPercent(0)).toBe(0)
    expect(capeFillPercent(126)).toBe(100)
  })
})

describe('fillShareAtLevel', () => {
  it('is how much of the fill at this level was there at the earlier one', () => {
    // level 50 fills half a cape and level 99 all of it
    expect(fillShareAtLevel(50, 99)).toBe(0.5)
    expect(fillShareAtLevel(58, 59)).toBeCloseTo(57 / 58, 10)
  })

  it('is none of it for a skill that started at level 1', () => {
    expect(fillShareAtLevel(1, 40)).toBe(0)
  })

  it('is all of it when no level was gained', () => {
    expect(fillShareAtLevel(70, 70)).toBe(1)
    // level 1 has no fill to take a share of
    expect(fillShareAtLevel(1, 1)).toBe(1)
  })

  it('never passes all of it, whatever it is handed', () => {
    expect(fillShareAtLevel(80, 60)).toBe(1)
  })
})

describe('rackOrder', () => {
  const skills = forEverySkill((skill) => {
    if (skill === 'thieving') return { level: 99, xp: 13_100_000 }
    if (skill === 'sailing') return { level: 1, xp: 0 }
    if (skill === 'cooking') return { level: 75, xp: 1_250_000 }
    if (skill === 'agility') return { level: 75, xp: 1_333_000 }
    if (skill === 'hitpoints') return { level: 75, xp: 1_300_000 }
    return { level: 50, xp: 101_333 }
  })

  it('hangs every skill once, lowest level first', () => {
    const order = rackOrder(skills)
    expect(order).toHaveLength(SKILL_KEYS.length)
    expect(new Set(order).size).toBe(SKILL_KEYS.length)
    expect(order.at(0)).toBe('sailing')
    expect(order.at(-1)).toBe('thieving')
  })

  it('orders skills on the same level by XP', () => {
    expect(rackOrder(skills).slice(-4, -1)).toEqual(['cooking', 'hitpoints', 'agility'])
  })

  it('keeps the hiscores order between skills that are level and XP alike', () => {
    expect(rackOrder(skills).slice(1, 4)).toEqual(['attack', 'defence', 'strength'])
  })

  it('does not reorder the list of skills it reads from', () => {
    const before = [...SKILL_KEYS]
    rackOrder(skills)
    expect(SKILL_KEYS).toEqual(before)
  })
})

describe('accountCapes', () => {
  it("is an account's three highest skills, the highest last, so it hangs on top", () => {
    const skills = forEverySkill((skill) => {
      if (skill === 'thieving') return { level: 99, xp: 13_080_000 }
      if (skill === 'fishing') return { level: 85, xp: 3_435_000 }
      if (skill === 'firemaking') return { level: 85, xp: 3_390_000 }
      if (skill === 'runecraft') return { level: 85, xp: 3_294_000 }
      return { level: 60, xp: 273_742 }
    })
    expect(accountCapes(skills)).toEqual(['firemaking', 'fishing', 'thieving'])
  })

  it('takes the far end of the rack for a fresh account, where every skill is level with the others', () => {
    const skills = forEverySkill(() => ({ level: 1, xp: 0 }))
    expect(accountCapes(skills)).toEqual(rackOrder(skills).slice(-3))
  })
})

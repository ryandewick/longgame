import { describe, expect, it } from 'vitest'
import { computedXpPerHour, xpPerHourAt, xpPerRunAt } from '#shared/domain/rates'
import { accountWith, methodWith } from './helpers'

const anyone = accountWith()

describe('xpPerHourAt', () => {
  it('is the flat rate when the method has no bands', () => {
    const method = methodWith({ xpPerHour: 42_000 })
    expect(xpPerHourAt(method, 1, anyone)).toBe(42_000)
    expect(xpPerHourAt(method, 99, anyone)).toBe(42_000)
  })

  it('is the highest band the level has reached', () => {
    const method = methodWith({
      level: 15,
      xpPerHour: 20_000,
      rateBands: [
        { fromLevel: 15, xpPerHour: 20_000 },
        { fromLevel: 30, xpPerHour: 35_000 },
        { fromLevel: 60, xpPerHour: 50_000 },
      ],
    })
    expect(xpPerHourAt(method, 15, anyone)).toBe(20_000)
    expect(xpPerHourAt(method, 29, anyone)).toBe(20_000)
    expect(xpPerHourAt(method, 30, anyone)).toBe(35_000)
    expect(xpPerHourAt(method, 99, anyone)).toBe(50_000)
  })

  it('is the method’s own rate below its first band', () => {
    const method = methodWith({
      level: 15,
      xpPerHour: 20_000,
      rateBands: [
        { fromLevel: 15, xpPerHour: 20_000 },
        { fromLevel: 30, xpPerHour: 35_000 },
      ],
    })
    expect(xpPerHourAt(method, 5, anyone)).toBe(20_000)
  })

  it('works a computed rate out from the level, ignoring the flat rate', () => {
    const method = methodWith({ skill: 'ranged', xpPerHour: 0, computedRate: 'crab-ranged' })
    expect(xpPerHourAt(method, 59, anyone)).toBe(
      computedXpPerHour('crab-ranged', 'ranged', 59, anyone),
    )
    expect(xpPerHourAt(method, 59, anyone)).toBeGreaterThan(0)
  })
})

describe('computedXpPerHour', () => {
  // every figure here is the wiki's damage formula worked by hand, not read back off the code
  const level = (everySkill: number) => accountWith({ everySkill })

  it('gives the formula’s figures for Ranged on the Gemstone Crab', () => {
    // iron darts, steel darts, mithril darts, ruby bolts (e) from 46, a rosewood blowpipe from 65
    const rates = [1, 5, 19, 45, 46, 59, 64, 65, 99].map((ranged) =>
      computedXpPerHour('crab-ranged', 'ranged', ranged, anyone),
    )
    expect(rates).toEqual([4_500, 6_500, 15_000, 30_000, 42_000, 48_000, 51_500, 50_500, 76_500])
  })

  it('gives the formula’s figures for melee on the Gemstone Crab', () => {
    expect(computedXpPerHour('crab-melee', 'strength', 1, level(1))).toBe(3_500)
    expect(computedXpPerHour('crab-melee', 'attack', 1, level(1))).toBe(3_500)
    expect(computedXpPerHour('crab-melee', 'strength', 20, level(20))).toBe(12_000)
    expect(computedXpPerHour('crab-melee', 'attack', 40, level(40))).toBe(25_500)
    expect(computedXpPerHour('crab-melee', 'strength', 60, level(60))).toBe(43_500)
    expect(computedXpPerHour('crab-melee', 'strength', 99, level(99))).toBe(75_000)
    // the fixture account's levels
    const fixture = accountWith({ levels: { attack: 70, strength: 80, defence: 73 } })
    expect(computedXpPerHour('crab-melee', 'defence', 73, fixture)).toBe(59_000)
  })

  it('gives the formula’s figures for Magic on each crab', () => {
    const gemstone = [1, 9, 17, 71, 99].map((magic) =>
      computedXpPerHour('gem-magic', 'magic', magic, anyone),
    )
    expect(gemstone).toEqual([7_000, 15_000, 22_000, 61_000, 77_500])
    const rock = [1, 9, 13, 23, 47, 71, 99].map((magic) =>
      computedXpPerHour('rock-magic', 'magic', magic, anyone),
    )
    expect(rock).toEqual([7_500, 16_500, 19_500, 27_500, 45_000, 66_000, 81_500])
    const frost = [13, 71, 99].map((magic) =>
      computedXpPerHour('frost-magic', 'magic', magic, anyone),
    )
    expect(frost).toEqual([29_500, 71_500, 106_000])
  })

  it('rounds every estimate to the nearest 500', () => {
    const kinds = ['crab-melee', 'crab-ranged', 'rock-magic', 'frost-magic', 'gem-magic'] as const
    for (const kind of kinds) {
      for (let level = 1; level <= 99; level++) {
        expect(computedXpPerHour(kind, 'magic', level, anyone) % 500).toBe(0)
      }
    }
  })

  it('has no rate on frost crabs below Fire Strike, the one element the method casts there', () => {
    expect(computedXpPerHour('frost-magic', 'magic', 12, anyone)).toBe(0)
    expect(computedXpPerHour('frost-magic', 'magic', 13, anyone)).toBeGreaterThan(0)
  })

  it('casts the newest spell of any element on the Gemstone Crab and on rock crabs', () => {
    // Wind Strike from level 1
    expect(computedXpPerHour('gem-magic', 'magic', 1, anyone)).toBeGreaterThan(0)
    expect(computedXpPerHour('rock-magic', 'magic', 1, anyone)).toBeGreaterThan(0)
    // a 20% weakness does not keep Earth Strike ahead of Wind Bolt at 17 or Water Bolt at 23
    expect(computedXpPerHour('rock-magic', 'magic', 23, anyone)).toBeGreaterThan(
      computedXpPerHour('rock-magic', 'magic', 16, anyone),
    )
    // Wind Bolt at 17 beats Fire Strike, and Water Bolt at 23 beats Wind Bolt
    expect(computedXpPerHour('gem-magic', 'magic', 17, anyone)).toBeGreaterThan(
      computedXpPerHour('gem-magic', 'magic', 16, anyone),
    )
    expect(computedXpPerHour('gem-magic', 'magic', 23, anyone)).toBeGreaterThan(
      computedXpPerHour('gem-magic', 'magic', 22, anyone),
    )
  })

  it('gives every spell of a tier the max hit of the best one unlocked', () => {
    // on rock crabs Earth Wave is still the cast at 75, now with Fire Wave’s max hit of 20 before
    // its own 20%: 66,500 if it had kept its own 19
    expect(computedXpPerHour('rock-magic', 'magic', 74, anyone)).toBe(66_000)
    expect(computedXpPerHour('rock-magic', 'magic', 75, anyone)).toBe(68_000)
  })

  it('gives estimates that never fall as the level rises, but for the blowpipe at 65', () => {
    const kinds = ['rock-magic', 'frost-magic', 'gem-magic', 'crab-ranged'] as const
    for (const kind of kinds) {
      for (let level = 2; level <= 99; level++) {
        // the wiki has the blowpipe match ruby bolts at 65: it is 1,000 an hour behind there
        if (kind === 'crab-ranged' && level === 65) continue
        expect(
          computedXpPerHour(kind, 'magic', level, anyone),
          `${kind} ${level}`,
        ).toBeGreaterThanOrEqual(computedXpPerHour(kind, 'magic', level - 1, anyone))
      }
    }
  })

  it('takes melee max hit from Strength when training Attack or Defence', () => {
    const weak = accountWith({ levels: { strength: 30 } })
    const strong = accountWith({ levels: { strength: 90 } })
    expect(computedXpPerHour('crab-melee', 'attack', 50, strong)).toBeGreaterThan(
      computedXpPerHour('crab-melee', 'attack', 50, weak),
    )
  })

  it('takes the weapon and how often it lands from Attack', () => {
    // 60 Strength with an iron scimitar that misses nearly half the time, against a dragon one
    const noAttack = accountWith({ levels: { attack: 1, strength: 60 } })
    expect(computedXpPerHour('crab-melee', 'strength', 60, noAttack)).toBe(12_500)
    expect(computedXpPerHour('crab-melee', 'strength', 60, level(60))).toBe(43_500)
    // a rune scimitar at 99 Strength
    const runeScimitar = accountWith({ levels: { attack: 40, strength: 99 } })
    expect(computedXpPerHour('crab-melee', 'strength', 99, runeScimitar)).toBe(54_500)
    // and Attack trained with no Strength behind it hits for almost nothing
    expect(computedXpPerHour('crab-melee', 'attack', 99, level(1))).toBe(7_000)
  })

  it('takes the level asked about when training Strength itself', () => {
    const account = accountWith({ levels: { strength: 30 } })
    expect(computedXpPerHour('crab-melee', 'strength', 90, account)).toBeGreaterThan(
      computedXpPerHour('crab-melee', 'strength', 30, account),
    )
  })

  it('gives Strength the aggressive style’s edge over Attack at the same level', () => {
    const account = accountWith({ levels: { attack: 70, strength: 70 } })
    expect(computedXpPerHour('crab-melee', 'strength', 70, account)).toBeGreaterThanOrEqual(
      computedXpPerHour('crab-melee', 'attack', 70, account),
    )
  })
})

describe('xpPerRunAt', () => {
  it('is nothing for a method that is not a timed run', () => {
    expect(xpPerRunAt(methodWith(), 50, anyone)).toBe(0)
  })

  it('grows in step with the hourly rate', () => {
    const run = methodWith({
      skill: 'farming',
      level: 15,
      xpPerHour: 100_000,
      timedRun: { xpPerRun: 3_000, everyMinutes: 200 },
      rateBands: [
        { fromLevel: 15, xpPerHour: 100_000 },
        { fromLevel: 45, xpPerHour: 400_000 },
      ],
    })
    expect(xpPerRunAt(run, 15, anyone)).toBe(3_000)
    expect(xpPerRunAt(run, 45, anyone)).toBe(12_000)
  })

  it('stays flat when the source gives no hourly rate to scale by', () => {
    const run = methodWith({ xpPerHour: 0, timedRun: { xpPerRun: 233, everyMinutes: 160 } })
    expect(xpPerRunAt(run, 80, anyone)).toBe(233)
  })
})

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
  it('gives the vanilla app’s figures', () => {
    // read off the old app for a 71 Magic, 59 Ranged, 80 Strength account
    const account = accountWith({ levels: { strength: 80 } })
    expect(computedXpPerHour('rock-magic', 'magic', 71, account)).toBe(66_500)
    expect(computedXpPerHour('frost-magic', 'magic', 71, account)).toBe(71_500)
    expect(computedXpPerHour('gem-magic', 'magic', 71, account)).toBe(61_000)
    expect(computedXpPerHour('crab-ranged', 'ranged', 59, account)).toBe(47_000)
    expect(computedXpPerHour('crab-melee', 'defence', 73, account)).toBe(56_000)
  })

  it('rounds every estimate to the nearest 500', () => {
    const kinds = ['crab-melee', 'crab-ranged', 'rock-magic', 'frost-magic', 'gem-magic'] as const
    for (const kind of kinds) {
      for (let level = 1; level <= 99; level++) {
        expect(computedXpPerHour(kind, 'magic', level, anyone) % 500).toBe(0)
      }
    }
  })

  it('has no magic rate below the first spell of the element', () => {
    expect(computedXpPerHour('rock-magic', 'magic', 8, anyone)).toBe(0)
    expect(computedXpPerHour('rock-magic', 'magic', 9, anyone)).toBeGreaterThan(0)
    expect(computedXpPerHour('frost-magic', 'magic', 12, anyone)).toBe(0)
    expect(computedXpPerHour('frost-magic', 'magic', 13, anyone)).toBeGreaterThan(0)
  })

  it('uses whichever of fire and earth is better on the Gemstone Crab', () => {
    // earth strike opens at 9, before fire strike at 13
    expect(computedXpPerHour('gem-magic', 'magic', 9, anyone)).toBeGreaterThan(0)
    expect(computedXpPerHour('gem-magic', 'magic', 13, anyone)).toBeGreaterThanOrEqual(
      computedXpPerHour('gem-magic', 'magic', 9, anyone),
    )
  })

  it('gives magic estimates that never fall as the level rises', () => {
    const kinds = ['rock-magic', 'frost-magic', 'gem-magic'] as const
    for (const kind of kinds) {
      for (let level = 2; level <= 99; level++) {
        expect(computedXpPerHour(kind, 'magic', level, anyone)).toBeGreaterThanOrEqual(
          computedXpPerHour(kind, 'magic', level - 1, anyone),
        )
      }
    }
  })

  it('takes melee max hit from Strength when training Attack or Defence', () => {
    const weak = accountWith({ levels: { strength: 30 } })
    const strong = accountWith({ levels: { strength: 90 } })
    expect(computedXpPerHour('crab-melee', 'attack', 50, strong)).toBeGreaterThan(
      computedXpPerHour('crab-melee', 'attack', 50, weak),
    )
    // the Attack level itself changes nothing: the crab has no defence to beat
    expect(computedXpPerHour('crab-melee', 'attack', 99, weak)).toBe(
      computedXpPerHour('crab-melee', 'attack', 1, weak),
    )
  })

  it('takes the level asked about when training Strength itself', () => {
    const account = accountWith({ levels: { strength: 30 } })
    expect(computedXpPerHour('crab-melee', 'strength', 90, account)).toBeGreaterThan(
      computedXpPerHour('crab-melee', 'strength', 30, account),
    )
  })

  it('gives Strength the aggressive style’s edge over Attack at the same level', () => {
    const account = accountWith({ levels: { strength: 70 } })
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

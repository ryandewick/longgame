import { describe, expect, it } from 'vitest'
import type { Method } from '#shared/types/method'
import type { MethodOption } from '#shared/domain/methods'
import {
  TICK_MANIPULATION_PAGE,
  isOffBySetting,
  methodNeedsText,
  methodRateText,
  methodSuppliesText,
  tickPerfectTagTitle,
} from '~~/app/utils/method-rows'
import { methodWith } from '../domain/helpers'
import { fixtureAccount, insightFor } from './skills-fixture'

const optionWith = (
  method: Partial<Method>,
  changes: Partial<Omit<MethodOption, 'method'>> = {},
): MethodOption => ({
  method: methodWith(method),
  xpPerHour: 10_000,
  xpPerRun: 0,
  missing: [],
  unlocked: true,
  ...changes,
})

describe('methodRateText', () => {
  it('gives the XP an hour the wiki gives', () => {
    expect(methodRateText(optionWith({}, { xpPerHour: 194_000 }))).toBe('≈ 194k/h')
  })

  it('marks a rate worked out from the account as an estimate', () => {
    const option = optionWith({ computedRate: 'crab-ranged' }, { xpPerHour: 47_250 })
    expect(methodRateText(option)).toBe('est. 47k/h')
  })

  it('says when there is no rate', () => {
    expect(methodRateText(optionWith({}, { xpPerHour: 0 }))).toBe('no rate')
  })

  it('gives a timed run by the run', () => {
    const run = { xpPerRun: 12_400, everyMinutes: 80 }
    const option = optionWith({ timedRun: run }, { xpPerHour: 900_000, xpPerRun: 12_400 })
    expect(methodRateText(option)).toBe('≈ 12k a run')
  })

  it('falls back to the hourly rate of a run the source gives no XP for', () => {
    const run = { xpPerRun: 0, everyMinutes: 80 }
    expect(methodRateText(optionWith({ timedRun: run }, { xpPerHour: 30_000 }))).toBe('≈ 30k/h')
    expect(methodRateText(optionWith({ timedRun: run }, { xpPerHour: 0 }))).toBe('no rate')
  })
})

describe('methodNeedsText', () => {
  it('is empty when the account lacks nothing but the level', () => {
    expect(methodNeedsText(optionWith({ level: 90 }, { unlocked: false }))).toBe('')
  })

  it('lists what the account lacks as one sentence', () => {
    const option = optionWith(
      {},
      {
        unlocked: false,
        missing: [{ kind: 'quest', quest: 'Monkey Madness II' }, { kind: 'grand-exchange' }],
      },
    )
    expect(methodNeedsText(option)).toBe('Needs Monkey Madness II, the Grand Exchange.')
  })

  it('writes the Methods rows for Ranged on the fixture account', () => {
    const needs = Object.fromEntries(
      insightFor(fixtureAccount(), 'ranged').methods.map((option) => [
        option.method.name,
        methodNeedsText(option),
      ]),
    )
    expect(needs).toMatchObject({
      'Gemstone Crab': '',
      'Chinning maniacal monkeys (grey chins)': 'Needs Monkey Madness II, the Grand Exchange.',
      'Chinning maniacal monkeys (red chins)': 'Needs Monkey Madness II.',
      'Pest Control points': 'Needs 100 combat.',
    })
  })
})

describe('methodSuppliesText', () => {
  it('tells a main what the method costs', () => {
    expect(methodSuppliesText(methodWith({ cost: 'profit' }), false)).toBe('pays')
    expect(methodSuppliesText(methodWith({ cost: 'free' }), false)).toBe('free')
    expect(methodSuppliesText(methodWith({ cost: 'cheap' }), false)).toBe('cheap')
    expect(methodSuppliesText(methodWith({ cost: 'pricey' }), false)).toBe('pricey')
  })

  it('tells an ironman whose supplies it runs on, whatever it would cost', () => {
    const method = methodWith({ cost: 'pricey', usesOwnSupplies: true })
    expect(methodSuppliesText(method, true)).toBe('your own')
    expect(methodSuppliesText(methodWith({ cost: 'pricey' }), true)).toBe('none')
  })
})

describe('the Tick-perfect tag', () => {
  it('links to the wiki’s page on tick manipulation', () => {
    expect(TICK_MANIPULATION_PAGE).toBe('https://oldschool.runescape.wiki/w/Tick_manipulation')
  })

  it('says what the method needs and where the link goes, on a guide and for a player who plans with it', () => {
    const said =
      'Needs tick manipulation: acting on exact game ticks so the skill rolls more often. Its rate assumes you have practised it. Opens the wiki’s page on tick manipulation.'
    expect(tickPerfectTagTitle()).toBe(said)
    expect(tickPerfectTagTitle(true)).toBe(said)
  })

  it('dims a tick-perfect method while the player has tick-perfect methods off, and nothing else', () => {
    const tick = optionWith({ name: 'Granite (3-tick)', tickPerfect: true })
    expect(isOffBySetting(tick, false)).toBe(true)
    expect(isOffBySetting(tick, true)).toBe(false)
    expect(isOffBySetting(optionWith({ name: 'Iron ore powermining' }), false)).toBe(false)
    // a table that is not told the setting leaves the row as it is
    expect(isOffBySetting(tick)).toBe(false)
  })

  it('tells a player with tick-perfect methods off that plans leave it out, and how to change that', () => {
    expect(tickPerfectTagTitle(false)).toBe(
      'Needs tick manipulation: acting on exact game ticks so the skill rolls more often. Its rate assumes you have practised it. Plans and estimates leave it out until you turn on tick-perfect methods in Settings. Opens the wiki’s page on tick manipulation.',
    )
  })
})

/*
 * A small, made-up method table that stands in for shared/data/methods in the rule tests, so
 * each rule can be pinned down with numbers that are easy to check by hand and do not move when
 * the wiki data does. Use it with:
 *
 *   vi.mock('#shared/data/methods', () => import('./sample-methods'))
 *
 * Skills that are not listed have no methods at all.
 */
import type { Method } from '#shared/types/method'
import type { SkillKey } from '#shared/types/skill'
import { forEverySkill } from '#shared/data/skills'
import { parseRequirements } from '#shared/domain/requirements'
import { methodWith } from './helpers'

const SAMPLE: Partial<Record<SkillKey, Partial<Method>[]>> = {
  // a tick-perfect method, a quest-locked method, and one method of each intensity
  mining: [
    { name: 'Granite (3-tick)', level: 1, xpPerHour: 90_000, tickPerfect: true },
    { name: 'Iron ore', level: 1, xpPerHour: 30_000 },
    { name: 'Crashed stars', level: 10, xpPerHour: 25_000, intensity: 'afk' },
    { name: 'Motherlode Mine', level: 30, xpPerHour: 35_000, intensity: 'semi' },
    {
      name: 'Volcanic Mine',
      level: 50,
      xpPerHour: 80_000,
      requirements: parseRequirements('q:Bone Voyage'),
    },
  ],
  // an expensive method next to a cheap one
  cooking: [
    { name: 'Jugs of wine', level: 1, xpPerHour: 100_000, intensity: 'afk', cost: 'pricey' },
    { name: 'Shrimp', level: 1, xpPerHour: 20_000, intensity: 'afk', cost: 'cheap' },
  ],
  // nothing but an expensive method
  construction: [{ name: 'Mahogany tables', level: 1, xpPerHour: 200_000, cost: 'pricey' }],
  // a method for mains, a route for ironmen, and one for both
  smithing: [
    { name: 'Bought bars', level: 1, xpPerHour: 100_000, audience: 'main' },
    { name: 'Smelted ore', level: 1, xpPerHour: 20_000, audience: 'iron', usesOwnSupplies: true },
    { name: 'Cannonballs', level: 1, xpPerHour: 10_000, intensity: 'afk' },
  ],
  // one activity that trains three skills, with per-trip setup, and a rival without it
  attack: [
    {
      name: 'Nightmare Zone',
      level: 1,
      xpPerHour: 60_000,
      intensity: 'afk',
      perTripSetup: true,
    },
    { name: 'Sand crabs', level: 1, xpPerHour: 50_000, intensity: 'afk' },
  ],
  strength: [
    {
      name: 'Nightmare Zone',
      level: 1,
      xpPerHour: 60_000,
      intensity: 'afk',
      perTripSetup: true,
    },
  ],
  defence: [
    {
      name: 'Nightmare Zone',
      level: 1,
      xpPerHour: 60_000,
      intensity: 'afk',
      perTripSetup: true,
    },
  ],
  // one activity in two styles, and the same activity in another skill
  ranged: [
    { name: 'Crab with a crossbow', level: 1, xpPerHour: 40_000, intensity: 'afk' },
    { name: 'Crab with darts', level: 1, xpPerHour: 30_000, intensity: 'afk' },
  ],
  magic: [{ name: 'Crab with spells', level: 1, xpPerHour: 20_000, intensity: 'afk' }],
  // no rates at all
  slayer: [
    { name: 'Turael', level: 1, xpPerHour: 0 },
    { name: 'Vannaka', level: 1, xpPerHour: 0, requirements: parseRequirements('c:40') },
  ],
  // quest-skip advice and a single semi-AFK method
  agility: [
    { name: 'Quest skip to 32', level: 1, xpPerHour: 0, questSkip: true },
    { name: 'Rooftop courses', level: 1, xpPerHour: 10_000, intensity: 'semi' },
  ],
  // timed runs and one thing to grind
  farming: [
    {
      name: 'Herb runs',
      level: 1,
      xpPerHour: 60_000,
      timedRun: { xpPerRun: 2_000, everyMinutes: 80 },
      rateBands: [
        { fromLevel: 1, xpPerHour: 60_000 },
        { fromLevel: 50, xpPerHour: 120_000 },
      ],
    },
    {
      name: 'Tree runs',
      level: 15,
      xpPerHour: 500_000,
      timedRun: { xpPerRun: 6_000, everyMinutes: 2_880 },
    },
    { name: 'Tithe Farm', level: 34, xpPerHour: 50_000 },
  ],
  // nothing at all until a high level
  fishing: [{ name: 'Barbarian fishing', level: 58, xpPerHour: 60_000 }],
  // a timed run in a skill that is not trained by runs
  hunter: [
    {
      name: 'Birdhouse runs',
      level: 1,
      xpPerHour: 300_000,
      timedRun: { xpPerRun: 500, everyMinutes: 50 },
    },
    { name: 'Butterflies', level: 1, xpPerHour: 5_000 },
  ],
}

export const METHODS: Readonly<Record<SkillKey, readonly Method[]>> = forEverySkill((skill) =>
  (SAMPLE[skill] ?? []).map((overrides) => methodWith({ ...overrides, skill })),
)

import type { Requirements } from './requirement'
import type { SkillKey } from './skill'

/** How much attention a method takes. */
export type Intensity = 'afk' | 'semi' | 'active'

export type MethodCost = 'profit' | 'free' | 'cheap' | 'pricey'

/** 'main' needs the Grand Exchange; 'iron' is a route only an ironman would take. */
export type MethodAudience = 'both' | 'main' | 'iron'

/** Rates the wiki does not give, worked out from the account's own levels (see domain/rates.ts). */
export type ComputedRateKind =
  'crab-melee' | 'crab-ranged' | 'rock-magic' | 'frost-magic' | 'gem-magic'

/** From this level up, the method gives this much XP an hour. */
export interface RateBand {
  readonly fromLevel: number
  readonly xpPerHour: number
}

/** A run done on a timer (a herb run, a birdhouse run) rather than ground for hours. */
export interface TimedRun {
  /** XP from one run at the method's own level; 0 when the source gives none. */
  readonly xpPerRun: number
  /** Minutes before the run can be done again; 0 when the source gives none. */
  readonly everyMinutes: number
}

/** One way to train a skill. */
export interface Method {
  readonly skill: SkillKey
  /** The level the method opens at. */
  readonly level: number
  readonly name: string
  /** XP an hour at the method's own level; 0 when the wiki gives no rate. */
  readonly xpPerHour: number
  readonly intensity: Intensity
  readonly cost: MethodCost
  readonly requirements: Requirements
  readonly note: string
  /** The OSRS Wiki page the figures came from. */
  readonly source: string
  readonly audience: MethodAudience
  readonly timedRun?: TimedRun
  /** An ironman has to gather the supplies first, which makes the method worth less to them. */
  readonly usesOwnSupplies: boolean
  /** Needs tick-perfect play: only offered when the player asks for it. */
  readonly tickPerfect: boolean
  /** Advice for the first levels (quest rewards, the museum quiz): shown, but never dealt. */
  readonly questSkip: boolean
  /** Each trip needs setting up (a fee, potions, a quest list), so AFK blocks prefer others. */
  readonly perTripSetup: boolean
  /** The rate at each step as it rises with level; only present when there are several steps. */
  readonly rateBands?: readonly RateBand[]
  /** The rate is an estimate worked out from the account's levels; `xpPerHour` is then 0. */
  readonly computedRate?: ComputedRateKind
}

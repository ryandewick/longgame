import type { LevelNeed } from './quest'

/** Who may count a boost: everyone, nobody, or an account at this level (to make it, or to use it). */
export type BoostRule = 'always' | 'never' | LevelNeed

/**
 * A temporary boost to one skill that may count toward a boostable quest or diary level (decision
 * 1), from datasrc/boosts.json. Never toward a training method's level: a boost lasts minutes.
 */
export interface Boost {
  readonly name: string
  /** How a sentence names it: 'a super fishing potion'. */
  readonly phrase: string
  /** The wiki page it was read from, and the revision read. */
  readonly page: string
  readonly revision: number
  /** The size: a flat number of levels, or a base plus a share of the level boosted. */
  readonly amount:
    { readonly flat: number } | { readonly base: number; readonly percentOfLevel: number }
  /** Who may count it. */
  readonly main: BoostRule
  readonly ironman: BoostRule
}

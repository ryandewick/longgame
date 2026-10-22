import type { Account } from '../types/account'
import type { Boost, BoostRule } from '../types/boost'
import type { LevelNeed } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { BOOSTS } from '../data/boosts'
import { isIronman } from './account'

/*
 * Boosts toward a quest's or a diary tier's boostable levels (decision 1). A level counts as met
 * when the account's level plus the biggest boost it may count reaches it. A main may count
 * anything it can buy, and a dragon axe's or pickaxe's special with 60 Attack; an ironman, what it
 * can make or reach at its levels. Never toward a training method's level: a boost lasts minutes.
 */

/** A boost, and the levels it gives the account. */
export interface SizedBoost {
  readonly boost: Boost
  readonly size: number
}

/** A boost the account may not count yet, the level that lets it, and the levels it would give. */
export interface BoostWithin extends SizedBoost {
  readonly unlockedBy: LevelNeed
}

/** The levels a boost adds at this level: flat, or its base plus its share of the level, rounded down. */
export function boostSize(boost: Boost, level: number): number {
  return 'flat' in boost.amount
    ? boost.amount.flat
    : boost.amount.base + Math.floor((level * boost.amount.percentOfLevel) / 100)
}

/** Who may count the boost, for this account's type. */
function ruleFor(account: Account, boost: Boost): BoostRule {
  return isIronman(account) ? boost.ironman : boost.main
}

/** May the account count this boost now? */
function mayCount(account: Account, boost: Boost): boolean {
  const rule = ruleFor(account, boost)
  if (rule === 'always' || rule === 'never') return rule === 'always'
  return account.skills[rule.skill].level >= rule.level
}

/** The biggest boost to a skill the account may count now, or null when it may count none. */
export function biggestBoost(account: Account, skill: SkillKey): SizedBoost | null {
  const level = account.skills[skill].level
  let biggest: SizedBoost | null = null
  for (const boost of BOOSTS[skill] ?? []) {
    if (!mayCount(account, boost)) continue
    const size = boostSize(boost, level)
    if (!biggest || size > biggest.size) biggest = { boost, size }
  }
  return biggest
}

/**
 * The boost that would cover a level the account is short of with the fewest levels to train
 * first, when none it may count now does: a super fishing potion for an ironman with 60 Herblore
 * and 57 of the 62 Fishing Swan Song needs, made at 62 Herblore. Only a boost that takes fewer
 * levels to get than the skill itself would to train; null when there is none.
 */
export function nearestBoost(account: Account, need: LevelNeed): BoostWithin | null {
  const has = account.skills[need.skill].level
  let nearest: { readonly boost: BoostWithin; readonly levelsToTrain: number } | null = null
  for (const boost of BOOSTS[need.skill] ?? []) {
    const rule = ruleFor(account, boost)
    if (rule === 'always' || rule === 'never' || mayCount(account, boost)) continue
    const levelsToTrain = rule.level - account.skills[rule.skill].level
    if (levelsToTrain >= need.level - has) continue
    // a boost unlocked in the same skill (Trapper's tipple at 46 Hunter) works from that level
    const base = rule.skill === need.skill ? rule.level : has
    const size = boostSize(boost, base)
    if (base + size < need.level) continue
    if (!nearest || levelsToTrain < nearest.levelsToTrain)
      nearest = { boost: { boost, size, unlockedBy: rule }, levelsToTrain }
  }
  return nearest?.boost ?? null
}

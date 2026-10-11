import type { Account } from '../types/account'
import type { ComputedRateKind, Method } from '../types/method'
import type { SkillKey } from '../types/skill'

/*
 * Rates the wiki leaves out, worked out from the account's own levels. They are estimates and
 * the app says so wherever one is shown. All of them assume no potions and no prayer, and round
 * to the nearest 500 so they do not look more exact than they are.
 */

const TICK_SECONDS = 0.6
/** The Gemstone Crab gives 87.5% of normal combat XP. */
const GEMSTONE_CRAB_XP_SHARE = 0.875
/** The crab has no defence, so about 97% of swings and shots land. */
const HIT_CHANCE_WITHOUT_DEFENCE = 0.97
/** Attack, Strength, Defence and Ranged all give 4 XP for each point of damage. */
const XP_PER_DAMAGE = 4

function roundToNearest500(xpPerHour: number): number {
  return Math.round(xpPerHour / 500) * 500
}

/** The game's max hit formula with no prayer or potion boost. */
function maxHit(effectiveLevel: number, strengthBonus: number): number {
  return Math.floor(0.5 + (effectiveLevel * (strengthBonus + 64)) / 640)
}

/** Ranged strength of the ammunition and weapons the wiki's progression uses, from their pages. */
const RANGED_STRENGTH = {
  steelDart: 3,
  mithrilDart: 9,
  adamantDart: 17,
  rubyBoltsEnchanted: 103,
  rosewoodBlowpipe: 6,
}

/**
 * Ranged on the Gemstone Crab, rapid style. The wiki's progression: darts before 46 (2 ticks a
 * throw on rapid), an adamant crossbow with enchanted ruby bolts from 46 (5 ticks, and the bolt
 * effect adds about 60 damage every 20 shots or so, 3 a shot), a rosewood blowpipe with adamant
 * darts from 65 (2 ticks).
 */
function crabRangedRate(level: number): number {
  let rangedStrength = RANGED_STRENGTH.steelDart
  let ticksPerShot = 2
  let boltEffectDamagePerShot = 0
  if (level >= 65) {
    rangedStrength = RANGED_STRENGTH.rosewoodBlowpipe + RANGED_STRENGTH.adamantDart
  } else if (level >= 46) {
    rangedStrength = RANGED_STRENGTH.rubyBoltsEnchanted
    ticksPerShot = 5
    boltEffectDamagePerShot = 3
  } else if (level >= 20) {
    rangedStrength = RANGED_STRENGTH.mithrilDart
  }
  const damagePerShot =
    (maxHit(level + 8, rangedStrength) / 2) * HIT_CHANCE_WITHOUT_DEFENCE + boltEffectDamagePerShot
  const shotsPerHourTimesDamage = (damagePerShot * 3600) / (ticksPerShot * TICK_SECONDS)
  return roundToNearest500(shotsPerHourTimesDamage * XP_PER_DAMAGE * GEMSTONE_CRAB_XP_SHARE)
}

/**
 * Melee on the Gemstone Crab: a 4-tick weapon makes 1,500 swings an hour, each averaging half
 * the max hit. Gear is assumed to keep up with the account, from +40 strength bonus at 30
 * Strength to +110 at 90. Max hit comes from Strength whichever melee skill is being trained,
 * and training Strength itself gets the aggressive style's 3 extra levels.
 */
function crabMeleeRate(skill: SkillKey, level: number, account: Account): number {
  const trainingStrength = skill === 'strength'
  const strength = trainingStrength ? level : account.skills.strength.level
  const strengthBonus = Math.max(40, Math.min(110, Math.round(40 + ((strength - 30) * 7) / 6)))
  const hit = maxHit(strength + 8 + (trainingStrength ? 3 : 0), strengthBonus)
  const swingsPerHour = 1500
  return roundToNearest500(
    ((swingsPerHour * hit) / 2) *
      XP_PER_DAMAGE *
      GEMSTONE_CRAB_XP_SHARE *
      HIT_CHANCE_WITHOUT_DEFENCE,
  )
}

interface CombatSpell {
  readonly level: number
  /** XP for the cast itself, given even on a splash. */
  readonly baseXp: number
  readonly maxHit: number
}

/** The fire strike, bolt, blast, wave and surge spells, from their wiki pages. */
const FIRE_SPELLS: readonly CombatSpell[] = [
  { level: 13, baseXp: 11.5, maxHit: 8 },
  { level: 35, baseXp: 22.5, maxHit: 12 },
  { level: 59, baseXp: 34.5, maxHit: 16 },
  { level: 75, baseXp: 42.5, maxHit: 20 },
  { level: 95, baseXp: 50.5, maxHit: 24 },
]

/** The earth spells, at the lower of the max hits the wiki gives. */
const EARTH_SPELLS: readonly CombatSpell[] = [
  { level: 9, baseXp: 9.5, maxHit: 6 },
  { level: 29, baseXp: 19.5, maxHit: 11 },
  { level: 53, baseXp: 31.5, maxHit: 15 },
  { level: 70, baseXp: 40, maxHit: 19 },
  { level: 90, baseXp: 48.2, maxHit: 23 },
]

interface AutocastTarget {
  /** The target's elemental weakness, a percentage added to both damage and accuracy. */
  readonly weaknessPercent: number
  /** The share of normal XP the target gives. */
  readonly xpShare: number
  /** The share of the hour spent casting, the rest going on resetting aggression. */
  readonly uptime: number
}

/**
 * Autocasting the best spell the level allows: 1,200 casts an hour from a 5-tick staff. A cast
 * gives its base XP even on a splash, plus 2 XP per damage, and an average hit is half the max,
 * which makes the damage XP of a cast its hit chance times its max hit.
 */
function autocastRate(
  level: number,
  spells: readonly CombatSpell[],
  target: AutocastTarget,
): number {
  const spell = spells.findLast((candidate) => candidate.level <= level)
  if (!spell) return 0
  const castsPerHour = 1200
  const baseHitChance = 0.95
  const weakness = target.weaknessPercent
  const hit = spell.maxHit + Math.floor((spell.maxHit * weakness) / 100)
  const hitChance = Math.min(0.99, baseHitChance * (1 + weakness / 100))
  return roundToNearest500(
    castsPerHour * (spell.baseXp + hitChance * hit) * target.xpShare * target.uptime,
  )
}

/** Rock crabs are weak to earth by 20% and need walking away from every ten minutes. */
const ROCK_CRAB: AutocastTarget = { weaknessPercent: 20, xpShare: 1, uptime: 0.9 }
/** Frost crabs are weak to fire by 100%, with the same aggression reset. */
const FROST_CRAB: AutocastTarget = { weaknessPercent: 100, xpShare: 1, uptime: 0.9 }
/** The Gemstone Crab has no weakness and never needs resetting, but gives reduced XP. */
const GEMSTONE_CRAB: AutocastTarget = {
  weaknessPercent: 0,
  xpShare: GEMSTONE_CRAB_XP_SHARE,
  uptime: 1,
}

/** What is this estimated rate for a skill at a level, given the rest of the account? */
export function computedXpPerHour(
  kind: ComputedRateKind,
  skill: SkillKey,
  level: number,
  account: Account,
): number {
  switch (kind) {
    case 'crab-melee':
      return crabMeleeRate(skill, level, account)
    case 'crab-ranged':
      return crabRangedRate(level)
    case 'rock-magic':
      return autocastRate(level, EARTH_SPELLS, ROCK_CRAB)
    case 'frost-magic':
      return autocastRate(level, FIRE_SPELLS, FROST_CRAB)
    case 'gem-magic':
      return Math.max(
        autocastRate(level, FIRE_SPELLS, GEMSTONE_CRAB),
        autocastRate(level, EARTH_SPELLS, GEMSTONE_CRAB),
      )
  }
}

/**
 * How much XP an hour does this method give when its skill is at this level? A computed rate
 * wins; otherwise the highest rate band the level has reached, or the flat rate.
 */
export function xpPerHourAt(method: Method, level: number, account: Account): number {
  if (method.computedRate) {
    return computedXpPerHour(method.computedRate, method.skill, level, account)
  }
  let rate = method.xpPerHour
  for (const band of method.rateBands ?? []) {
    if (band.fromLevel <= level) rate = band.xpPerHour
  }
  return rate
}

/**
 * How much XP does one timed run give at this level? The source gives the figure for the
 * method's own level; it grows in step with the hourly rate as better crops unlock.
 * 0 for anything that is not a timed run.
 */
export function xpPerRunAt(method: Method, level: number, account: Account): number {
  const xpPerRun = method.timedRun?.xpPerRun
  if (!xpPerRun) return 0
  if (method.xpPerHour <= 0) return xpPerRun
  return (xpPerRun * xpPerHourAt(method, level, account)) / method.xpPerHour
}

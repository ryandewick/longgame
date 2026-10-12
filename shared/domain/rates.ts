import type { Account } from '../types/account'
import type { ComputedRateKind, Method } from '../types/method'
import type { SkillKey } from '../types/skill'

/*
 * Rates the wiki leaves out, worked out from the account's own levels with the wiki's damage
 * formulas (Damage per second/Melee, /Ranged and /Magic). They are estimates and the app says so
 * wherever one is shown. All of them assume no potions and no prayer, and round to the nearest
 * 500 so they do not look more exact than they are.
 */

const TICK_SECONDS = 0.6
/** The Gemstone Crab gives 87.5% of normal combat XP. */
const GEMSTONE_CRAB_XP_SHARE = 0.875
/** Attack, Strength, Defence and Ranged all give 4 XP for each point of damage. */
const XP_PER_DAMAGE = 4
/** Magic gives 2 XP for each point of damage, on top of the XP for the cast. */
const MAGIC_XP_PER_DAMAGE = 2
/** Every level gets 8 added before it goes into a max hit or an accuracy roll. */
const EFFECTIVE_LEVEL_BONUS = 8
/** The style that trains a melee skill on its own adds 3 levels to that skill's side of a swing. */
const MELEE_STYLE_BONUS = 3

function roundToNearest500(xpPerHour: number): number {
  return Math.round(xpPerHour / 500) * 500
}

/** The game's max hit for melee and Ranged with no prayer or potion boost. */
function maxHit(effectiveLevel: number, strengthBonus: number): number {
  return Math.floor(0.5 + (effectiveLevel * (strengthBonus + 64)) / 640)
}

/** A level and an equipment bonus as the roll the game makes with them, to hit or to defend. */
function combatRoll(effectiveLevel: number, equipmentBonus: number): number {
  return effectiveLevel * (equipmentBonus + 64)
}

/** The chance that an attack lands, from the attacker's roll and the defender's. */
function hitChance(attackRoll: number, defenceRoll: number): number {
  if (attackRoll > defenceRoll) return 1 - (defenceRoll + 2) / (2 * (attackRoll + 1))
  return attackRoll / (2 * (defenceRoll + 1))
}

/** What a hit that lands deals on average: it rolls from 0 to the max hit, and a 0 counts as 1. */
function averageHit(highestHit: number): number {
  return highestHit / 2 + 1 / (highestHit + 1)
}

/** The last row of a table in level order that the level has reached. */
function rowReachedAt<Row extends { readonly fromLevel: number }>(
  rows: readonly Row[],
  level: number,
): Row | undefined {
  return rows.findLast((row) => row.fromLevel <= level)
}

/** A monster defends with its level plus 9: Defence against melee and Ranged, Magic against spells. */
function monsterDefenceRoll(level: number, defenceBonus: number): number {
  return combatRoll(level + 9, defenceBonus)
}

/** The Gemstone Crab and the rock, frost, sand and ammonite crabs all have 1 Defence and 1 Magic. */
const CRAB_LEVEL = 1
/** None of them has a melee or Ranged defence bonus. */
const CRAB_DEFENCE_ROLL = monsterDefenceRoll(CRAB_LEVEL, 0)

interface RangedWeapon {
  readonly fromLevel: number
  /** Ranged strength of the weapon and its ammunition together. */
  readonly rangedStrength: number
  readonly rangedAttack: number
  /** On the rapid style. */
  readonly ticksPerShot: number
  /** Fires enchanted ruby bolts, whose effect counts on top of the ordinary hit. */
  readonly rubyBolts?: boolean
}

/**
 * The wiki's progression for Ranged on the Gemstone Crab, with each item's bonuses from its page:
 * iron darts, steel darts, mithril darts, an adamant crossbow with enchanted ruby bolts, and a
 * rosewood blowpipe (+6 strength, +22 attack) with adamant darts (+17).
 */
const CRAB_RANGED_WEAPONS: readonly RangedWeapon[] = [
  { fromLevel: 1, rangedStrength: 2, rangedAttack: 0, ticksPerShot: 2 },
  { fromLevel: 5, rangedStrength: 3, rangedAttack: 0, ticksPerShot: 2 },
  { fromLevel: 20, rangedStrength: 9, rangedAttack: 0, ticksPerShot: 2 },
  { fromLevel: 46, rangedStrength: 103, rangedAttack: 78, ticksPerShot: 5, rubyBolts: true },
  { fromLevel: 65, rangedStrength: 23, rangedAttack: 22, ticksPerShot: 2 },
]

/** Enchanted ruby bolts take a fifth of the target's Hitpoints on 6% of shots, hit or miss. */
const RUBY_BOLT_EFFECT_CHANCE = 0.06
/** The Gemstone Crab counts as having 300 Hitpoints for that effect. */
const RUBY_BOLT_EFFECT_DAMAGE = 60

/**
 * Ranged on the Gemstone Crab, rapid style. Accuracy comes from the weapon alone: armour would
 * add a few percent to the hit chance at most.
 */
function crabRangedRate(level: number): number {
  const weapon = rowReachedAt(CRAB_RANGED_WEAPONS, level)
  if (!weapon) return 0
  const effectiveLevel = level + EFFECTIVE_LEVEL_BONUS
  const chance = hitChance(combatRoll(effectiveLevel, weapon.rangedAttack), CRAB_DEFENCE_ROLL)
  let damagePerShot = chance * averageHit(maxHit(effectiveLevel, weapon.rangedStrength))
  if (weapon.rubyBolts) {
    damagePerShot =
      RUBY_BOLT_EFFECT_CHANCE * RUBY_BOLT_EFFECT_DAMAGE +
      (1 - RUBY_BOLT_EFFECT_CHANCE) * damagePerShot
  }
  const shotsPerHour = 3600 / (weapon.ticksPerShot * TICK_SECONDS)
  return roundToNearest500(shotsPerHour * damagePerShot * XP_PER_DAMAGE * GEMSTONE_CRAB_XP_SHARE)
}

interface MeleeGear {
  /** The Attack level a weapon needs, or the level the rest of the gear is assumed from. */
  readonly fromLevel: number
  readonly slashAttack: number
  readonly strength: number
}

/** The 4-tick weapon of each tier, from their pages: iron, steel, mithril, adamant, rune, dragon. */
const SCIMITARS: readonly MeleeGear[] = [
  { fromLevel: 1, slashAttack: 10, strength: 9 },
  { fromLevel: 5, slashAttack: 15, strength: 14 },
  { fromLevel: 20, slashAttack: 21, strength: 20 },
  { fromLevel: 30, slashAttack: 29, strength: 28 },
  { fromLevel: 40, slashAttack: 45, strength: 44 },
  { fromLevel: 60, slashAttack: 67, strength: 66 },
]

/**
 * What is worn besides the weapon, assumed from the lower of Attack and Strength: an amulet of
 * strength from the start; a combat bracelet, climbing boots and a berserker helm from 40; and
 * from 70 Barrows gloves, a dragon defender, dragon boots and a fighter torso with that amulet
 * and helm. Each bonus is from the item's page.
 */
const MELEE_OTHER_SLOTS: readonly MeleeGear[] = [
  { fromLevel: 1, slashAttack: 0, strength: 10 },
  { fromLevel: 40, slashAttack: 7, strength: 21 },
  { fromLevel: 70, slashAttack: 36, strength: 39 },
]

/** A 4-tick weapon swings 1,500 times an hour. */
const SCIMITAR_SWINGS_PER_HOUR = 3600 / (4 * TICK_SECONDS)

/**
 * Melee on the Gemstone Crab with the scimitar the Attack level allows. Attack decides the weapon
 * and how often it lands, Strength how hard: the skill being trained is taken at the level asked
 * about and the other as the account has it. Training Strength gets the aggressive style's 3
 * extra levels and training Attack the accurate style's.
 */
function crabMeleeRate(skill: SkillKey, level: number, account: Account): number {
  const attack = skill === 'attack' ? level : account.skills.attack.level
  const strength = skill === 'strength' ? level : account.skills.strength.level
  const weapon = rowReachedAt(SCIMITARS, attack)
  const otherSlots = rowReachedAt(MELEE_OTHER_SLOTS, Math.min(attack, strength))
  if (!weapon || !otherSlots) return 0

  const effectiveStrength =
    strength + EFFECTIVE_LEVEL_BONUS + (skill === 'strength' ? MELEE_STYLE_BONUS : 0)
  const effectiveAttack =
    attack + EFFECTIVE_LEVEL_BONUS + (skill === 'attack' ? MELEE_STYLE_BONUS : 0)
  const highestHit = maxHit(effectiveStrength, weapon.strength + otherSlots.strength)
  const chance = hitChance(
    combatRoll(effectiveAttack, weapon.slashAttack + otherSlots.slashAttack),
    CRAB_DEFENCE_ROLL,
  )
  return roundToNearest500(
    SCIMITAR_SWINGS_PER_HOUR *
      chance *
      averageHit(highestHit) *
      XP_PER_DAMAGE *
      GEMSTONE_CRAB_XP_SHARE,
  )
}

type Element = 'wind' | 'water' | 'earth' | 'fire'

interface ElementalSpell {
  readonly element: Element
  readonly level: number
  /** XP for the cast itself, given even on a splash. */
  readonly baseXp: number
}

interface SpellTier {
  /** The max hit of every spell in the tier while only its first is unlocked. */
  readonly firstMaxHit: number
  /** What that max hit rises by as each later spell of the tier unlocks. */
  readonly maxHitStep: number
  /** In the order they unlock. */
  readonly spells: readonly ElementalSpell[]
}

/** The strike, bolt, blast, wave and surge spells, from their wiki pages. */
const SPELL_TIERS: readonly SpellTier[] = [
  {
    firstMaxHit: 2,
    maxHitStep: 2,
    spells: [
      { element: 'wind', level: 1, baseXp: 5.5 },
      { element: 'water', level: 5, baseXp: 7.5 },
      { element: 'earth', level: 9, baseXp: 9.5 },
      { element: 'fire', level: 13, baseXp: 11.5 },
    ],
  },
  {
    firstMaxHit: 9,
    maxHitStep: 1,
    spells: [
      { element: 'wind', level: 17, baseXp: 13.5 },
      { element: 'water', level: 23, baseXp: 16.5 },
      { element: 'earth', level: 29, baseXp: 19.5 },
      { element: 'fire', level: 35, baseXp: 22.5 },
    ],
  },
  {
    firstMaxHit: 13,
    maxHitStep: 1,
    spells: [
      { element: 'wind', level: 41, baseXp: 25.5 },
      { element: 'water', level: 47, baseXp: 28.5 },
      { element: 'earth', level: 53, baseXp: 31.5 },
      { element: 'fire', level: 59, baseXp: 34.5 },
    ],
  },
  {
    firstMaxHit: 17,
    maxHitStep: 1,
    spells: [
      { element: 'wind', level: 62, baseXp: 36 },
      { element: 'water', level: 65, baseXp: 37.5 },
      { element: 'earth', level: 70, baseXp: 40 },
      { element: 'fire', level: 75, baseXp: 42.5 },
    ],
  },
  {
    firstMaxHit: 21,
    maxHitStep: 1,
    spells: [
      { element: 'wind', level: 81, baseXp: 44.5 },
      { element: 'water', level: 85, baseXp: 46.5 },
      { element: 'earth', level: 90, baseXp: 48.2 },
      { element: 'fire', level: 95, baseXp: 50.5 },
    ],
  },
]

const EVERY_ELEMENT: readonly Element[] = ['wind', 'water', 'earth', 'fire']
/** An elemental staff gives +10 Magic attack and nothing to damage. */
const STAFF_MAGIC_ATTACK = 10
/** A staff autocasts a standard spell every 5 ticks. */
const AUTOCASTS_PER_HOUR = 3600 / (5 * TICK_SECONDS)

interface AutocastTarget {
  /** The elements the method casts: its estimate is the best spell among them. */
  readonly elements: readonly Element[]
  /** The element the target is weak to, if any. */
  readonly weakTo?: Element
  /** That weakness, a percentage added to both the damage and the accuracy of the element. */
  readonly weaknessPercent: number
  readonly magicDefenceBonus: number
  /** The share of normal XP the target gives. */
  readonly xpShare: number
  /** The share of the hour spent casting, the rest going on resetting aggression. */
  readonly uptime: number
}

/**
 * Autocasting the best spell the level allows from an elemental staff. Every spell of a tier
 * shares the max hit of the best one unlocked. A cast gives its base XP even on a splash, plus
 * XP for the damage it does.
 */
function autocastRate(level: number, target: AutocastTarget): number {
  const effectiveLevel = level + EFFECTIVE_LEVEL_BONUS
  const defenceRoll = monsterDefenceRoll(CRAB_LEVEL, target.magicDefenceBonus)
  let bestXpPerCast = 0
  for (const tier of SPELL_TIERS) {
    const unlocked = tier.spells.filter((spell) => spell.level <= level)
    const tierMaxHit = tier.firstMaxHit + tier.maxHitStep * (unlocked.length - 1)
    for (const spell of unlocked) {
      if (!target.elements.includes(spell.element)) continue
      const weakness = spell.element === target.weakTo ? target.weaknessPercent : 0
      const highestHit = tierMaxHit + Math.floor((tierMaxHit * weakness) / 100)
      const attackRoll = Math.floor(
        (combatRoll(effectiveLevel, STAFF_MAGIC_ATTACK) * (100 + weakness)) / 100,
      )
      const damagePerCast = hitChance(attackRoll, defenceRoll) * averageHit(highestHit)
      bestXpPerCast = Math.max(bestXpPerCast, spell.baseXp + MAGIC_XP_PER_DAMAGE * damagePerCast)
    }
  }
  return roundToNearest500(AUTOCASTS_PER_HOUR * bestXpPerCast * target.xpShare * target.uptime)
}

/**
 * Rock crabs are weak to earth by 20%, which keeps an earth spell ahead of the rest of its tier
 * but not of a newer tier, so every element is cast. They need walking away from every ten minutes.
 */
const ROCK_CRAB: AutocastTarget = {
  elements: EVERY_ELEMENT,
  weakTo: 'earth',
  weaknessPercent: 20,
  magicDefenceBonus: 0,
  xpShare: 1,
  uptime: 0.9,
}
/**
 * Frost crabs are weak to fire by 100% and have -50 Magic defence, with the same reset. The method
 * is fire spells, which that weakness keeps ahead of nearly every newer spell of another element.
 */
const FROST_CRAB: AutocastTarget = {
  elements: ['fire'],
  weakTo: 'fire',
  weaknessPercent: 100,
  magicDefenceBonus: -50,
  xpShare: 1,
  uptime: 0.9,
}
/**
 * The Gemstone Crab has no weakness, so the newest spell of any element is the one to cast. It
 * never needs resetting, but gives reduced XP: taken off the cast XP as well as the damage XP,
 * which no page settles either way.
 */
const GEMSTONE_CRAB: AutocastTarget = {
  elements: EVERY_ELEMENT,
  weaknessPercent: 0,
  magicDefenceBonus: 0,
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
      return autocastRate(level, ROCK_CRAB)
    case 'frost-magic':
      return autocastRate(level, FROST_CRAB)
    case 'gem-magic':
      return autocastRate(level, GEMSTONE_CRAB)
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

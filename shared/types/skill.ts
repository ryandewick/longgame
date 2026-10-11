/** The 24 skills, spelled as the hiscores spell them in lower case. */
export type SkillKey =
  | 'attack'
  | 'defence'
  | 'strength'
  | 'hitpoints'
  | 'ranged'
  | 'prayer'
  | 'magic'
  | 'cooking'
  | 'woodcutting'
  | 'fletching'
  | 'fishing'
  | 'firemaking'
  | 'crafting'
  | 'smithing'
  | 'mining'
  | 'herblore'
  | 'agility'
  | 'thieving'
  | 'slayer'
  | 'farming'
  | 'runecraft'
  | 'hunter'
  | 'construction'
  | 'sailing'

export type SkillCategory = 'combat' | 'gather' | 'artisan' | 'support'

export interface SkillDefinition {
  readonly key: SkillKey
  readonly name: string
  readonly category: SkillCategory
  /** Trained as a side effect of other skills (Hitpoints): never dealt, and no hours of its own. */
  readonly passive: boolean
  /** Trained by timed runs (Farming): the time left is counted in days of runs, not hours. */
  readonly daily: boolean
}

/** A skill as the hiscores report it. */
export interface SkillStat {
  readonly level: number
  readonly xp: number
}

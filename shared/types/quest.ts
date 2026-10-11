import type { SkillKey } from './skill'

/** XP the player may put in a skill of their choice. */
export interface LampReward {
  /** The reward in words: 'Two 10,000 xp lamps for any skill at level 40 or above.' */
  readonly description: string
  readonly totalXp: number
}

/** A quest or miniquest and the XP it pays. */
export interface Quest {
  readonly name: string
  /** XP that always goes to the same skill. */
  readonly fixedXp: Readonly<Partial<Record<SkillKey, number>>>
  readonly lamps?: LampReward
  /** Skill levels the wiki lists as needed to finish it. */
  readonly skillLevelsNeeded: Readonly<Partial<Record<SkillKey, number>>>
  readonly miniquest: boolean
}

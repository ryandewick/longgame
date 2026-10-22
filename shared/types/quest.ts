import type { SkillKey } from './skill'

/**
 * What an entry of the quest list is: a quest, one part of Recipe for Disaster, a miniquest, or an
 * activity. The two activities (Knight Waves and the natural history quiz) are on neither of the
 * game's lists, but they pay XP and the player ticks them like quests.
 */
export type QuestKind = 'quest' | 'subquest' | 'miniquest' | 'activity'

/** How far a quest has to have got: finished, or only started. */
export type QuestState = 'finished' | 'started'

/** XP the player may put in a skill of their choice. */
export interface LampReward {
  /** The reward in words: 'Two 10,000 xp lamps for any skill at level 40 or above.' */
  readonly description: string
  readonly totalXp: number
}

/**
 * What the app knows about an entry of the quest list, from datasrc/quest_facts.json: every quest,
 * subquest and miniquest the game has, and the two activities.
 */
export interface QuestFacts {
  readonly name: string
  readonly kind: QuestKind
  /** The wiki page the facts were read from, and the revision read. */
  readonly page: string
  readonly revision: number
  /** The skill levels its own page lists as needed, as the app counts them. */
  readonly levels: Readonly<Partial<Record<SkillKey, number>>>
  /**
   * The quests that must be finished before it can be, in name order: the ones its page names,
   * and Druidic Ritual where one of its Herblore levels could not be had without it.
   */
  readonly requires: readonly string[]
  /**
   * The quests that only have to be started before it can be finished, in name order: The
   * Restless Ghost for Creature of Fenkenstrain. Not part of the quest chains, since finishing this
   * quest says only that those were started.
   */
  readonly requiresStarted: readonly string[]
  /** Lamps it pays that the lamp table does not list: the Varrock Museum's, after the quest. */
  readonly lamps?: LampReward
  /** A miniquest that no quest and no diary task needs. */
  readonly optional: boolean
  /** Every account has done it: Learning the Ropes, which every player finishes to reach the mainland. */
  readonly doneByEveryAccount: boolean
  /**
   * Something needs it only started (another quest, a diary tier, an either-or choice, a goal),
   * so a player can tell the app it is started: Fairytale II for the fairy rings.
   */
  readonly startedMatters: boolean
}

/** A quest, miniquest or activity and the XP it pays. */
export interface Quest {
  readonly name: string
  readonly kind: QuestKind
  /** XP that always goes to the same skill. */
  readonly fixedXp: Readonly<Partial<Record<SkillKey, number>>>
  readonly lamps?: LampReward
  /** Skill levels its wiki page lists as needed to finish it (its `QuestFacts` levels). */
  readonly skillLevelsNeeded: Readonly<Partial<Record<SkillKey, number>>>
}

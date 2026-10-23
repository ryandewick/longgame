import type { SkillKey } from './skill'

/**
 * What an entry of the quest list is: a quest, one part of Recipe for Disaster, a miniquest, or an
 * activity. The two activities (Knight Waves and the natural history quiz) are on neither of the
 * game's lists, but they pay XP and the player ticks them like quests.
 */
export type QuestKind = 'quest' | 'subquest' | 'miniquest' | 'activity'

/** How far a quest has to have got: finished, or only started. */
export type QuestState = 'finished' | 'started'

/** A skill at a level. */
export interface LevelNeed {
  readonly skill: SkillKey
  readonly level: number
}

/**
 * Something an ironman has to make or gather for a quest, and the levels that takes: one of the
 * options, each a set of levels that go together. A need with a condition (free-to-play only,
 * only if the given karambwan burns) never stands in the way.
 */
export interface IronmanNeed {
  /** What has to be made: 'a Neitiznot shield'. */
  readonly need: string
  readonly options: readonly (readonly LevelNeed[])[]
  /** When it applies, in words; null when it always does. */
  readonly condition: string | null
}

/** What a quest needs beyond its levels and the quests before it, for readiness. */
export interface QuestNeeds {
  /** The skills whose level may be met with a boost. */
  readonly boostable: readonly SkillKey[]
  /** The skills whose level is needed only to finish, not to start. */
  readonly finishOnly: readonly SkillKey[]
  /** The skills whose level its page says can be got round, so it never stands in the way. */
  readonly bypassable: readonly SkillKey[]
  /** Quest points, combat level and Kudos needed; 0 for none. */
  readonly questPoints: number
  readonly combat: number
  readonly kudos: number
  /** What an ironman has to make for it. */
  readonly ironman: readonly IronmanNeed[]
}

/** XP the player puts in a skill of their choice: a lamp, or a reward with a choice of skills. */
export interface XpChoice {
  readonly count: number
  /** The XP of each one. */
  readonly xp: number
  /** The skills it may go in; 'any' for a lamp that takes every skill. */
  readonly skills: 'any' | readonly SkillKey[]
  /** The level the chosen skill must be at; 0 when there is none. */
  readonly minLevel: number
}

/** What finishing a quest counts toward. */
export interface QuestGives {
  readonly questPoints: number
  readonly kudos: number
  /** Kudos it makes available afterwards: The Dig Site opens the cleaning of finds. */
  readonly kudosOpened: number
  /** XP the player places (decision 3): lamps, and rewards with a choice of skills. */
  readonly xpChoices: readonly XpChoice[]
  /** XP it pays in a set skill during the quest or once after it, on top of its fixed XP. */
  readonly xpDuring: Readonly<Partial<Record<SkillKey, number>>>
}

/** How long something takes at an ordinary pace, in minutes: 2 times speedrun pace for `mid` (decision 9). */
export interface Minutes {
  readonly low: number
  readonly mid: number
  readonly high: number
}

/** How long a quest takes. */
export interface QuestTime {
  /** Null for an entry the data does not time: Recipe for Disaster as a whole (its parts are timed), the activities. */
  readonly minutes: Minutes | null
  /** What an ironman spends on top, gathering what a main would buy. */
  readonly ironmanMinutes: number
  /** Time spent waiting (a plant growing, a brew fermenting); the ironman's own waits apart. */
  readonly waitMinutes: number
  readonly ironmanWaitMinutes: number
}

/** Where an Optimal quest guide does a quest: the step that finishes it, and an earlier one that starts it. */
export interface GuidePlace {
  readonly finish: number | null
  readonly start: number | null
}

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
  /** What it needs beyond its levels and the quests before it. */
  readonly needs: QuestNeeds
  /** What finishing it counts toward. */
  readonly gives: QuestGives
  readonly time: QuestTime
  /** Where each Optimal quest guide does it; null for a guide that never does. */
  readonly guide: { readonly main: GuidePlace | null; readonly ironman: GuidePlace | null }
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

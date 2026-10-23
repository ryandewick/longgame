import type { LevelNeed, QuestState } from './quest'

/** Where each Optimal quest guide reaches a goal: its step, or null for a guide that never does. */
export interface GoalGuide {
  readonly main: number | null
  readonly ironman: number | null
}

/**
 * A milestone worth heading for, from datasrc/quest_goals.json: Barrows gloves, the fairy rings,
 * Piety and Chivalry. Its tree is every quest it needs, each finished or only started.
 */
export interface Goal {
  /** Its key in the data: 'fairy-rings'. */
  readonly id: string
  readonly name: string
  /** What it gives, in a sentence: 'Travel by the fairy ring network.' */
  readonly gives: string
  readonly quests: Readonly<Record<string, QuestState>>
  readonly diaries: readonly string[]
  /** Levels it needs beyond its quests' own: 70 Prayer and 70 Defence for Piety. */
  readonly levels: readonly LevelNeed[]
  /** It needs every quest: the quest point cape. */
  readonly allQuests: boolean
  /** It needs every diary tier: the achievement diary cape. */
  readonly allDiaries: boolean
  readonly guide: GoalGuide
  /** A milestone of the ironman guide alone, never offered to a main. */
  readonly ironmanOnly: boolean
}

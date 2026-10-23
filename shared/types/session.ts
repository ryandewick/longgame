import type { Intensity } from './method'
import type { SkillKey } from './skill'

/** What the player is up for tonight. 'afk' and 'active' are strict; 'balanced' alternates. */
export type Mood = 'balanced' | 'afk' | 'active'

/** The stopwatch every block carries. Times are milliseconds. */
export interface BlockTimer {
  /** Time banked while the timer was running, not counting the current stretch. */
  readonly elapsed: number
  /** When the current stretch started; null while paused. */
  readonly runningSince: number | null
  readonly done: boolean
}

/** A stretch of the session spent grinding one method. */
export interface SkillBlock extends BlockTimer {
  readonly kind: 'skill'
  readonly skill: SkillKey
  /** The method's name. */
  readonly title: string
  readonly note: string
  readonly minutes: number
  readonly intensity: Intensity
  /** The intensities this slot was dealt for, which a swap has to respect. */
  readonly wanted: readonly Intensity[]
  readonly xpPerHour: number
  /** The rate was worked out from the account's levels rather than taken from the wiki. */
  readonly rateIsEstimate: boolean
  /** XP the block should bring in at that rate. */
  readonly targetXp: number
}

/** Five minutes for a timed run or daily that has come due. */
export interface ResetBlock extends BlockTimer {
  readonly kind: 'reset'
  readonly resetKey: string
  readonly title: string
  readonly note: string
  readonly minutes: number
  readonly skill: SkillKey | null
}

/** A change of pace at the end of a long session. */
export interface WildcardBlock extends BlockTimer {
  readonly kind: 'wildcard'
  readonly title: string
  readonly note: string
  readonly minutes: number
}

/** Why a quest or diary step was dealt, as the session keeps it; Tonight says it in words. */
export type QuestStepReason =
  | {
      /** It saves hours: a quest the account is ready for, or the first step towards one (Next's first list). */
      readonly kind: 'saves'
      /** The quest the hours come from: the step itself, or the quest it leads to. */
      readonly quest: string
      readonly hours: number
      /** The methods and resets that quest opens. */
      readonly opens: readonly string[]
      /** The steps still to do between this one and that quest. */
      readonly between: number
    }
  | {
      /** The next quest towards a goal that saves no hours (decision 7). */
      readonly kind: 'unlock'
      readonly goal: string
      /** The goal's quests still to do, this one included. */
      readonly left: number
    }
  | {
      /** A diary tier to claim (decision 6). */
      readonly kind: 'tier'
      /** The methods and resets its reward opens. */
      readonly opens: readonly string[]
    }

/** A quest or diary step from the Quests page's Next, in the wildcard's place (approval 5). */
export interface QuestBlock extends BlockTimer {
  readonly kind: 'quest'
  /** The quest's or the diary tier's name. */
  readonly title: string
  /** Finish a quest, only start one, or claim a diary tier's reward. */
  readonly step: 'finish' | 'start' | 'claim'
  readonly minutes: number
  readonly reason: QuestStepReason
}

export type SessionBlock = SkillBlock | ResetBlock | WildcardBlock | QuestBlock

/** What a finished session brought in, measured against the XP it started with. */
export interface SessionTally {
  readonly gains: Readonly<Partial<Record<SkillKey, number>>>
  readonly totalXp: number
  /** Levels gained, for the skills that gained any. */
  readonly levels: Readonly<Partial<Record<SkillKey, number>>>
}

/** Tonight's plan, from the deal to the tally. */
export interface Session {
  readonly startedAt: number
  /** The length the player asked for. */
  readonly minutes: number
  readonly blocks: readonly SessionBlock[]
  /** Every skill's XP when the session was dealt. */
  readonly startingXp: Readonly<Record<SkillKey, number>>
  readonly endedAt: number | null
  readonly tally: SessionTally | null
}

/** A block as the history remembers it. */
export type HistoryBlock =
  | {
      readonly kind: 'skill'
      readonly skill: SkillKey
      readonly title: string
      readonly done: boolean
    }
  | {
      readonly kind: 'reset'
      readonly resetKey: string
      readonly title: string
      readonly done: boolean
    }
  | { readonly kind: 'wildcard'; readonly title: string; readonly done: boolean }
  | {
      readonly kind: 'quest'
      readonly step: QuestBlock['step']
      readonly title: string
      readonly done: boolean
    }

/** A finished session as the history keeps it. */
export interface HistoryEntry extends SessionTally {
  readonly endedAt: number
  /** The length the player asked for. */
  readonly minutes: number
  /** Milliseconds actually timed across all blocks. */
  readonly elapsed: number
  readonly blocks: readonly HistoryBlock[]
}

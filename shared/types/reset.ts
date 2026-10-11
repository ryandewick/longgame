import type { MethodAudience } from './method'
import type { Requirements } from './requirement'
import type { SkillKey } from './skill'

/** How often a reset comes round for one account. */
export type ResetCadence =
  /** So many minutes after it was last done. */
  | { readonly kind: 'interval'; readonly minutes: number }
  /** Once a game day: the game resets these at 00:00 UTC. */
  | { readonly kind: 'utc-midnight' }
  /** Seven days after it was last done. */
  | { readonly kind: 'weekly' }

/** From this level up, the reset takes this many minutes to come round. */
export interface CadenceStep {
  readonly fromLevel: number
  readonly minutes: number
}

/** How often a reset comes round: fixed, or by skill level, as better trees grow slower. */
export type ResetSchedule =
  | ResetCadence
  | { readonly kind: 'by-level'; readonly skill: SkillKey; readonly steps: readonly CadenceStep[] }

/** Something worth doing on a timer: a farm run, a daily shop, a weekly minigame. */
export interface Reset {
  readonly key: string
  readonly name: string
  readonly schedule: ResetSchedule
  /** The skill it trains, where it trains one. */
  readonly skill: SkillKey | null
  readonly requirements: Requirements
  readonly note: string
  /** The OSRS Wiki page the figures came from. */
  readonly source: string
  readonly audience: MethodAudience
}

/** Whether a reset can be done now. `lastDoneAt` is null when it has never been done. */
export type ResetStatus =
  | { readonly due: true; readonly lastDoneAt: number | null }
  | { readonly due: false; readonly readyInMilliseconds: number }

/** A change of pace dealt at the end of a long session. */
export interface Wildcard {
  readonly name: string
  readonly description: string
  readonly requirements: Requirements
}

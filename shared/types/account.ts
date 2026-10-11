import type { SkillKey, SkillStat } from './skill'

/** An ironman cannot use the Grand Exchange, so buys nothing and gathers its own supplies. */
export type AccountType = 'main' | 'iron'

/** 'cheap' leaves the expensive methods out wherever a cheaper one exists. Ironmen ignore it. */
export type Budget = 'any' | 'cheap'

export interface AccountPreferences {
  readonly budget: Budget
  /** Offer methods that need tick-perfect play. Off by default: they are hard to sustain. */
  readonly tickPerfect: boolean
  /** Skills the player never wants dealt in a session. */
  readonly excludedSkills: ReadonlySet<SkillKey>
}

/** Everything the rules need to know about a player. */
export interface Account {
  readonly type: AccountType
  readonly skills: Readonly<Record<SkillKey, SkillStat>>
  /** Quest names as the data spells them, with straight apostrophes. */
  readonly completedQuests: ReadonlySet<string>
  /** Region and tier, for example 'Ardougne Medium'. */
  readonly completedDiaries: ReadonlySet<string>
  /** The quest cape shortcut: every quest counts as done. */
  readonly allQuests: boolean
  /** The diary cape shortcut: every diary counts as done. */
  readonly allDiaries: boolean
  readonly preferences: AccountPreferences
}

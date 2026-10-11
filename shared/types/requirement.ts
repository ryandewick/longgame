import type { SkillKey } from './skill'

export interface SkillRequirement {
  readonly skill: SkillKey
  readonly level: number
}

/** What a method, reset or wildcard needs before an account can use it. Every entry must be met. */
export interface Requirements {
  readonly quests: readonly string[]
  /** In the order the source lists them, which is the order they are reported missing in. */
  readonly skills: readonly SkillRequirement[]
  /** Region and tier, for example 'Ardougne Medium'. */
  readonly diaries: readonly string[]
  /** Minimum combat level; 0 when there is none. */
  readonly combatLevel: number
}

/** One thing standing between an account and a method. */
export type MissingRequirement =
  | { readonly kind: 'quest'; readonly quest: string }
  | { readonly kind: 'skill'; readonly skill: SkillKey; readonly level: number }
  | { readonly kind: 'diary'; readonly diary: string }
  | { readonly kind: 'combat'; readonly level: number }
  /** The method buys its supplies, which an ironman cannot do. */
  | { readonly kind: 'grand-exchange' }

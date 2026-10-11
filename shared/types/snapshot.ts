import type { SkillKey } from './skill'

/** The account's XP at one moment, kept at every hiscores fetch. Pace is read from these. */
export interface XpSnapshot {
  readonly takenAt: number
  readonly skills: Readonly<Partial<Record<SkillKey, number>>>
  readonly totalXp: number
}

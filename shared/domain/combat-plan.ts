import type { Account } from '../types/account'
import type { SkillKey } from '../types/skill'
import { combatLevel, withXp } from './account'
import { hoursToLevel } from './estimates'
import { MAX_LEVEL, xpForLevel } from './xp'

/*
 * Combat levels at the fewest hours (decision 11). When a quest or a tier needs a combat level,
 * the planner raises one combat skill a level at a time, each time the one that buys the most
 * combat level per hour at the account's own rates. Every combat skill goes to 99 for max anyway,
 * so this only orders training the account needs regardless.
 */

/** The skills a plan may raise. Hitpoints is passive in the app, so it is taken as it is. */
const COMBAT_SKILLS: readonly SkillKey[] = [
  'attack',
  'strength',
  'defence',
  'ranged',
  'magic',
  'prayer',
]

/**
 * The game's combat formula before it is rounded down, so that a level which moves it only a
 * little still counts: a defensive base and the best of the three styles.
 */
function combatValue(account: Account): number {
  const level = (skill: SkillKey) => account.skills[skill].level
  const base = 0.25 * (level('defence') + level('hitpoints') + Math.floor(level('prayer') / 2))
  const bestStyle = Math.max(
    0.325 * (level('attack') + level('strength')),
    0.325 * Math.floor(1.5 * level('ranged')),
    0.325 * Math.floor(1.5 * level('magic')),
  )
  return base + bestStyle
}

/** How to reach a combat level: the hours of training, and the level each raised skill ends at. */
export interface CombatPlan {
  readonly hours: number
  readonly levels: Readonly<Partial<Record<SkillKey, number>>>
}

/** One step of a plan: a skill raised to a level, what that costs and what it buys. */
interface CombatStep {
  readonly skill: SkillKey
  readonly level: number
  readonly account: Account
  readonly hours: number
  readonly perHour: number
}

/** The cheapest next step: the skill whose next level buys the most combat level an hour. */
function cheapestStep(account: Account): CombatStep | null {
  const before = combatValue(account)
  let cheapest: CombatStep | null = null
  for (const skill of COMBAT_SKILLS) {
    const current = account.skills[skill].level
    // Prayer counts in pairs of levels, since the formula halves it and rounds down
    const level = current + (skill === 'prayer' && current % 2 === 0 ? 2 : 1)
    if (level > MAX_LEVEL) continue
    const raised = withXp(account, skill, xpForLevel(level) - account.skills[skill].xp)
    const gain = combatValue(raised) - before
    if (gain <= 0) continue
    const hours = hoursToLevel(account, skill, level)
    const perHour = hours > 0 ? gain / hours : Number.POSITIVE_INFINITY
    if (!cheapest || perHour > cheapest.perHour)
      cheapest = { skill, level, account: raised, hours, perHour }
  }
  return cheapest
}

/**
 * The cheapest way for the account to reach a combat level, by its own rates (decision 11). A
 * plan with no hours and no levels when it has the level already; null when it cannot get there,
 * every combat skill it could raise being 99.
 */
export function combatPlan(account: Account, target: number): CombatPlan | null {
  let working = account
  let hours = 0
  const levels: Partial<Record<SkillKey, number>> = {}
  while (combatLevel(working) < target) {
    const step = cheapestStep(working)
    if (!step) return null
    working = step.account
    hours += step.hours
    levels[step.skill] = step.level
  }
  return { hours, levels }
}

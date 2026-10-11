import type { Account } from '../types/account'
import type { Reset, ResetCadence, ResetStatus } from '../types/reset'
import type { SkillKey } from '../types/skill'
import { RESETS } from '../data/resets'
import { isIronman } from './account'
import { formatTimeAgo, formatWait } from './format'
import { meetsRequirements } from './requirements'

const MINUTE = 60_000
const DAY = 86_400_000

/** When each reset was last done, by reset key. A reset that is not in here has never been done. */
export type ResetLog = Readonly<Record<string, number>>

/** Is this reset for this kind of account? Some are closed to ironmen, some are only for them. */
export function resetAppliesTo(reset: Reset, account: Account): boolean {
  if (reset.audience === 'main') return !isIronman(account)
  if (reset.audience === 'iron') return isIronman(account)
  return true
}

/**
 * How often does this reset come round for this account? A schedule that steps with a skill
 * level is settled here: the highest step the level has reached, or the first step below that.
 */
export function resetCadence(account: Account, reset: Reset): ResetCadence {
  const { schedule } = reset
  if (schedule.kind !== 'by-level') return schedule
  const level = account.skills[schedule.skill].level
  let minutes = schedule.steps[0]?.minutes ?? 0
  for (const step of schedule.steps) {
    if (step.fromLevel <= level) minutes = step.minutes
  }
  return { kind: 'interval', minutes }
}

/** Can this reset be done now, and if not, how long until it can? */
export function resetStatus(
  account: Account,
  reset: Reset,
  lastDoneAt: number | undefined,
  now: number,
): ResetStatus {
  if (!lastDoneAt) return { due: true, lastDoneAt: null }

  const cadence = resetCadence(account, reset)
  if (cadence.kind === 'utc-midnight') {
    // the game hands these out once a game day: due if last done before today began in UTC
    const today = new Date(now)
    const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    return lastDoneAt < midnight
      ? { due: true, lastDoneAt }
      : { due: false, readyInMilliseconds: midnight + DAY - now }
  }

  const wait = cadence.kind === 'weekly' ? 7 * DAY : cadence.minutes * MINUTE
  const sinceDone = now - lastDoneAt
  return sinceDone >= wait
    ? { due: true, lastDoneAt }
    : { due: false, readyInMilliseconds: wait - sinceDone }
}

/** A reset's status in words: 'never done', 'due, last 3 h ago', 'ready in 25 min'. */
export function describeResetStatus(status: ResetStatus, now: number): string {
  if (!status.due) return 'ready in ' + formatWait(status.readyInMilliseconds)
  if (status.lastDoneAt === null) return 'never done'
  return 'due, last ' + formatTimeAgo(status.lastDoneAt, now)
}

/** When a due reset was last done, for beside the word "Due": 'never done', 'last 3 h ago'. */
export function describeLastDone(lastDoneAt: number | null, now: number): string {
  return lastDoneAt === null ? 'never done' : 'last ' + formatTimeAgo(lastDoneAt, now)
}

/** Below this many minutes a wait is given in minutes, and below the next in hours. */
const MINUTES_UP_TO = 120
const HOURS_UP_TO = 2 * 1440

/**
 * How often a reset comes round, in words: '50 min', '5.3 h', '3.6 days', 'Daily, 00:00 UTC',
 * 'Every 7 days'. Hours and days keep one decimal place, dropped when it is zero.
 */
export function describeResetCadence(cadence: ResetCadence): string {
  if (cadence.kind === 'utc-midnight') return 'Daily, 00:00 UTC'
  if (cadence.kind === 'weekly') return 'Every 7 days'
  const { minutes } = cadence
  if (minutes < MINUTES_UP_TO) return `${minutes} min`
  if (minutes < HOURS_UP_TO) return `${Number((minutes / 60).toFixed(1))} h`
  return `${Number((minutes / 1440).toFixed(1))} days`
}

/**
 * The skill the reset with this key trains. Null when it trains none, and for a key no reset
 * has any more (the history remembers resets by key, and the data can drop one).
 */
export function resetSkill(resetKey: string): SkillKey | null {
  return RESETS.find((reset) => reset.key === resetKey)?.skill ?? null
}

/** Which resets can this account do at all? The right account type, with every requirement met. */
export function unlockedResets(account: Account): Reset[] {
  return RESETS.filter(
    (reset) => resetAppliesTo(reset, account) && meetsRequirements(account, reset.requirements),
  )
}

/** Which unlocked resets are due now? In the data's order, which puts the quick farm runs first. */
export function dueResets(account: Account, log: ResetLog, now: number): Reset[] {
  return unlockedResets(account).filter(
    (reset) => resetStatus(account, reset, log[reset.key], now).due,
  )
}

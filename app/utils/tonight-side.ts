import type { Account } from '#shared/types/account'
import type { Reset, ResetStatus } from '#shared/types/reset'
import type { SkillKey, SkillStat } from '#shared/types/skill'
import { SKILL_KEYS, skillDefinition } from '#shared/data/skills'
import type { MaxProgress } from '#shared/domain/estimates'
import { formatNumber, formatShortNumber, formatWait } from '#shared/domain/format'
import { resetStatus, unlockedResets, type ResetLog } from '#shared/domain/resets'
import { MAX_LEVEL, MAX_XP } from '#shared/domain/xp'

/*
 * The three short lists beside the session on Tonight: resets, the capes closest to 99 and the
 * distance to max. The figures come from shared/domain; these choose what to list and word it.
 */

/** A reset the account can do, and whether it can be done now. */
export interface ResetRow {
  readonly reset: Reset
  readonly status: ResetStatus
}

/** Every reset the account has unlocked, the due ones first and otherwise in the data's order. */
export function resetsDueFirst(account: Account, log: ResetLog, now: number): ResetRow[] {
  return unlockedResets(account)
    .map((reset) => ({ reset, status: resetStatus(account, reset, log[reset.key], now) }))
    .sort((first, second) => Number(second.status.due) - Number(first.status.due))
}

/** The aside of the resets heading: '12 due', 'none due'. */
export function dueCountLabel(rows: readonly ResetRow[]): string {
  const dueCount = rows.filter((row) => row.status.due).length
  return dueCount ? `${dueCount} due` : 'none due'
}

/** How long until a reset comes round, where a due one would say "Due": 'in 34 min'. */
export function resetWaitLabel(readyInMilliseconds: number): string {
  return `in ${formatWait(readyInMilliseconds)}`
}

/** What the next-capes list needs to know about a skill. The account store's insight for a skill is one of these. */
export interface CapeOutlook {
  readonly skill: SkillKey
  readonly stat: SkillStat
  readonly hoursLeft: number
  readonly daysLeft: number
  readonly isRough: boolean
}

/**
 * The capes nearest to being earned: the skills under 99 with the fewest hours left, nearest
 * first. A passive skill (Hitpoints) has no hours of its own, so it is never listed.
 */
export function closestCapes(
  outlooks: Readonly<Record<SkillKey, CapeOutlook>>,
  count = 3,
): CapeOutlook[] {
  return SKILL_KEYS.filter(
    (skill) => outlooks[skill].stat.level < MAX_LEVEL && !skillDefinition(skill).passive,
  )
    .map((skill) => outlooks[skill])
    .sort((first, second) => first.hoursLeft - second.hoursLeft)
    .slice(0, count)
}

/** How far off a cape is: a figure for the game's font and the unit that follows it. */
export interface CapeDistance {
  readonly figure: string
  readonly unit: string
}

/**
 * How far off is the cape? Days of runs for a skill trained by them, otherwise hours, or
 * minutes inside the last hour. The unit owns up to an estimate that is rough.
 */
export function capeDistance(outlook: CapeOutlook): CapeDistance {
  const caveat = outlook.isRough ? ', rough' : ''
  if (outlook.daysLeft) {
    return { figure: formatNumber(outlook.daysLeft), unit: `days of runs${caveat}` }
  }
  if (outlook.hoursLeft < 1) {
    return { figure: String(Math.round(outlook.hoursLeft * 60)), unit: `min${caveat}` }
  }
  return { figure: formatNumber(outlook.hoursLeft), unit: `hours${caveat}` }
}

/** XP banked out of the XP of every skill at 99: '38.35M of 312.83M'. */
export function xpBankedLabel(progress: MaxProgress): string {
  const xpAtMax = progress.skillCount * MAX_XP
  return `${formatShortNumber(progress.xp)} of ${formatShortNumber(xpAtMax)}`
}

/**
 * How long until max at this many XP a day: '3,674 days'. With no pace to go on (too few
 * snapshots, or nothing gained in the window) it says so instead.
 */
export function daysToMaxLabel(progress: MaxProgress, xpPerDay: number): string {
  const xpLeft = progress.skillCount * MAX_XP - progress.xp
  if (xpPerDay <= 0 || xpLeft <= 0) return 'no pace yet'
  return `${formatNumber(xpLeft / xpPerDay)} days`
}

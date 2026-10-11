import type { HistoryEntry } from '../types/session'
import type { SkillKey } from '../types/skill'
import type { XpSnapshot } from '../types/snapshot'
import { dayKey } from './format'

const DAY = 86_400_000

/** Two snapshots closer together than this (about five hours) say too little to call a pace. */
const SHORTEST_SPAN_IN_DAYS = 0.2

/** XP gained per day, and the stretch of time it was measured over. */
export interface Pace {
  readonly xpPerDay: number
  /** Days between the first and last snapshot used. Under 0.2 there is no pace yet. */
  readonly days: number
}

/** The same moment of the day, `count` calendar days earlier, in the player's own time zone. */
function daysBefore(now: number, count: number): Date {
  const date = new Date(now)
  date.setDate(date.getDate() - count)
  return date
}

/**
 * How fast has the account been gaining XP over the last `days` days: in one skill, or in total
 * when no skill is given? Measured from the first snapshot inside the window to the latest one.
 * Snapshots must be oldest first.
 */
export function paceOver(
  snapshots: readonly XpSnapshot[],
  days: number,
  now: number,
  skill?: SkillKey,
): Pace {
  const latest = snapshots.at(-1)
  if (!latest) return { xpPerDay: 0, days: 0 }
  const windowStart = now - days * DAY
  const earliest = snapshots.find((snapshot) => snapshot.takenAt >= windowStart) ?? latest
  const span = (latest.takenAt - earliest.takenAt) / DAY
  if (span < SHORTEST_SPAN_IN_DAYS) return { xpPerDay: 0, days: span }
  const gained = skill
    ? (latest.skills[skill] ?? 0) - (earliest.skills[skill] ?? 0)
    : latest.totalXp - earliest.totalXp
  return { xpPerDay: gained / span, days: span }
}

/** The XP gained on one calendar day. */
export interface DailyGain {
  /** The day as '2026-10-10'. */
  readonly day: string
  readonly xp: number
  /** The first two letters of the weekday, for a chart axis: 'Sa'. */
  readonly weekday: string
}

/**
 * How much XP was gained on each of the last `days` calendar days, oldest first and ending
 * today? A day's gain runs from the last snapshot of the previous day on record, which may be
 * several days back, to its own last snapshot, so XP earned while no snapshot was taken lands
 * on the day it was noticed. Snapshots must be oldest first.
 */
export function dailyGains(
  snapshots: readonly XpSnapshot[],
  days: number,
  now: number,
): DailyGain[] {
  const firstOfDay = new Map<string, XpSnapshot>()
  const lastOfDay = new Map<string, XpSnapshot>()
  for (const snapshot of snapshots) {
    const day = dayKey(snapshot.takenAt)
    if (!firstOfDay.has(day)) firstOfDay.set(day, snapshot)
    lastOfDay.set(day, snapshot)
  }
  const recordedDays = [...lastOfDay.keys()].sort()

  const gains: DailyGain[] = []
  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const date = daysBefore(now, daysAgo)
    const day = dayKey(date.getTime())
    const closing = lastOfDay.get(day)
    const previousDay = recordedDays[recordedDays.indexOf(day) - 1]
    // the first day on record has no day before it: measure from its own first snapshot
    const opening = previousDay ? lastOfDay.get(previousDay) : firstOfDay.get(day)
    const gained = closing && opening ? closing.totalXp - opening.totalXp : 0
    gains.push({
      day,
      xp: Math.max(0, gained),
      weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2),
    })
  }
  return gains
}

/** How far back the streak looks for days with XP gained outside a session. */
const STREAK_WINDOW_IN_DAYS = 60

/**
 * How many days in a row has the account gained XP? A day counts if a finished session gained
 * anything or the snapshots show a gain. A day that has not counted yet does not break the
 * streak while it is still today: the count then runs up to yesterday.
 */
export function dayStreak(
  history: readonly HistoryEntry[],
  snapshots: readonly XpSnapshot[],
  now: number,
): number {
  const activeDays = new Set<string>()
  for (const entry of history) {
    if (Object.values(entry.gains).some((xp) => xp > 0)) activeDays.add(dayKey(entry.endedAt))
  }
  for (const gain of dailyGains(snapshots, STREAK_WINDOW_IN_DAYS, now)) {
    if (gain.xp > 0) activeDays.add(gain.day)
  }

  const isActive = (daysAgo: number) => activeDays.has(dayKey(daysBefore(now, daysAgo).getTime()))
  let daysAgo = isActive(0) ? 0 : 1
  let streak = 0
  while (isActive(daysAgo)) {
    streak++
    daysAgo++
  }
  return streak
}

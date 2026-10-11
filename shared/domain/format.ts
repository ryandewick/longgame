import type { Intensity, MethodCost } from '../types/method'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** What each intensity is called on screen. */
export const INTENSITY_LABELS: Readonly<Record<Intensity, string>> = {
  afk: 'AFK',
  semi: 'Semi-AFK',
  active: 'Active',
}

/** What each cost is called on screen. */
export const COST_LABELS: Readonly<Record<MethodCost, string>> = {
  profit: 'pays',
  free: 'free',
  cheap: 'cheap',
  pricey: 'pricey',
}

/** A whole number with British thousands separators: 13,034,431. */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-GB')
}

/** A number short enough for a tight column: 950, 13k, 1.25M. */
export function formatShortNumber(value: number): string {
  if (value >= 1e6) return (value / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
  if (value >= 1e3) return Math.round(value / 1e3) + 'k'
  return String(Math.round(value))
}

/** A length of time given in hours: '45 min', '2.5 h', '1,204 h'. */
export function formatHours(hours: number): string {
  if (hours < 1) return Math.round(hours * 60) + ' min'
  if (hours < 10) return hours.toFixed(1).replace(/\.0$/, '') + ' h'
  return formatNumber(hours) + ' h'
}

/** A stopwatch reading from milliseconds: '07:05'. Minutes keep counting past 59. */
export function formatClock(milliseconds: number): string {
  const clamped = Math.max(0, milliseconds)
  const minutes = Math.floor(clamped / MINUTE)
  const seconds = Math.floor((clamped % MINUTE) / 1000)
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
}

/** How long ago something happened, in the largest unit that fits: '5 min ago', '3 d ago'. */
export function formatTimeAgo(time: number, now: number): string {
  const minutes = (now - time) / MINUTE
  if (minutes < 1) return 'just now'
  if (minutes < 60) return Math.round(minutes) + ' min ago'
  if (minutes < 1440) return Math.round(minutes / 60) + ' h ago'
  return Math.round(minutes / 1440) + ' d ago'
}

/**
 * A wait, rounded up so it never promises too soon: '12 min', '5 h', '3 days'.
 * Hours are used up to two days because '36 h' says more than '2 days'.
 */
export function formatWait(milliseconds: number): string {
  if (milliseconds < HOUR) return Math.ceil(milliseconds / MINUTE) + ' min'
  if (milliseconds < 2 * DAY) return Math.ceil(milliseconds / HOUR) + ' h'
  return Math.ceil(milliseconds / DAY) + ' days'
}

/**
 * The calendar day a moment falls on, as '2026-10-10'. Days are the player's own, so this reads
 * the time zone of the machine it runs on: a session at 23:30 belongs to that evening.
 */
export function dayKey(time: number): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

import type { HistoryBlock } from '#shared/types/session'
import type { SkillKey } from '#shared/types/skill'
import { isSkillKey, skillName } from '#shared/data/skills'
import { formatShortNumber } from '#shared/domain/format'
import type { DailyGain } from '#shared/domain/pace'
import { resetSkill } from '#shared/domain/resets'

/*
 * How the History page words and scales what the history store holds: the fortnight's chart,
 * the sentence above it and the rows of the sessions table. The figures themselves come from
 * shared/domain/pace.ts.
 */

const DAYS_IN_A_WEEK = 7

/** '1 day', '2 days': a count with its noun, which takes an s unless there is exactly one. */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** XP gained over the last seven of the days given (they end today). */
export function xpThisWeek(gains: readonly DailyGain[]): number {
  return gains.slice(-DAYS_IN_A_WEEK).reduce((sum, gain) => sum + gain.xp, 0)
}

/** What follows the week's XP in the sentence above the chart. */
export function historyCountsSentence(counts: {
  readonly dayStreak: number
  readonly sessions: number
  readonly snapshots: number
}): string {
  return (
    `${counted(counts.dayStreak, 'day')} in a row. ` +
    `${counted(counts.sessions, 'session')} finished, ` +
    `${counted(counts.snapshots, 'snapshot')} taken.`
  )
}

/** One day of the chart. */
export interface HistoryChartBar {
  /** The day as '2026-10-10'. */
  readonly day: string
  /** The two letters under the bar: 'Sa'. */
  readonly weekday: string
  /** The bar's height as a share of the best day's, 0 to 100. */
  readonly heightPercent: number
  /** The figure above the bar: '+76k'. Empty on a day with nothing gained, which shows none. */
  readonly label: string
  /** The bar's tooltip: '2026-10-10 +76k'. */
  readonly title: string
  /** The day in words, for a reader who cannot see the bar: 'Saturday 10 October: +76k xp'. */
  readonly description: string
  readonly isToday: boolean
}

/** A '2026-10-10' day key as 'Saturday 10 October'. */
function spellOutDay(day: string): string {
  const [year = 0, month = 1, dayOfMonth = 1] = day.split('-').map(Number)
  const date = new Date(year, month - 1, dayOfMonth)
  // each part is asked for by itself: the separators a locale puts between them have changed over the years
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' })
  const monthName = date.toLocaleDateString('en-GB', { month: 'long' })
  return `${weekday} ${dayOfMonth} ${monthName}`
}

/**
 * The chart's bars from the daily gains, oldest first, the last one being today. Heights are
 * measured against the best day; with nothing gained on any day every bar is flat.
 */
export function historyChartBars(gains: readonly DailyGain[]): HistoryChartBar[] {
  const best = Math.max(1, ...gains.map((gain) => gain.xp))
  return gains.map((gain, index) => {
    const figure = `+${formatShortNumber(gain.xp)}`
    return {
      day: gain.day,
      weekday: gain.weekday,
      heightPercent: Number(((gain.xp / best) * 100).toFixed(1)),
      label: gain.xp > 0 ? figure : '',
      title: `${gain.day} ${figure}`,
      description: `${spellOutDay(gain.day)}: ${gain.xp > 0 ? `${figure} xp` : 'no xp'}`,
      isToday: index === gains.length - 1,
    }
  })
}

/** The skill a block of a finished session trained: its own, or the one its reset feeds. A wildcard has none. */
export function historyBlockSkill(block: HistoryBlock): SkillKey | null {
  if (block.kind === 'skill') return block.skill
  return block.kind === 'reset' ? resetSkill(block.resetKey) : null
}

/** What a block's icon says for itself: 'Ranged: Chinning' for a skill block, the title alone otherwise. */
export function describeHistoryBlock(block: HistoryBlock): string {
  return block.kind === 'skill' ? `${skillName(block.skill)}: ${block.title}` : block.title
}

/** The levels a session gained, in words: 'Ranged +1, Crafting +3'. Empty when it gained none. */
export function describeLevelsGained(levels: Readonly<Partial<Record<SkillKey, number>>>): string {
  return Object.entries(levels)
    .flatMap(([skill, gained]) => (isSkillKey(skill) ? [`${skillName(skill)} +${gained}`] : []))
    .join(', ')
}

/** The day a session ended, as the sessions table dates it: '10 Oct'. */
export function formatSessionDate(endedAt: number): string {
  return new Date(endedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

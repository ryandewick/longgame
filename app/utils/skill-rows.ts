import type { SkillSort } from '#shared/domain/save'
import type { SkillKey } from '#shared/types/skill'
import { skillDefinition, skillName } from '#shared/data/skills'
import { formatHours, formatShortNumber } from '#shared/domain/format'
import { MAX_LEVEL, xpToMax } from '#shared/domain/xp'
import type { SkillInsight } from '../stores/account'

/** One line of the Skills table, as text ready to draw. */
export interface SkillRow {
  readonly skill: SkillKey
  readonly name: string
  readonly level: number
  readonly isMaxed: boolean
  /** The level each of the skill's methods opens at, for the stops on its strip. */
  readonly methodLevels: readonly number[]
  /** '+11k a day' from the last week's snapshots; empty when there is no pace to show. */
  readonly pace: string
  /** XP still to gain, or the XP banked once the skill is 99. */
  readonly toMax: string
  readonly timeLeft: string
  /** The fastest method open now; empty for a maxed skill and for one with nothing open. */
  readonly bestNow: string
}

const isMaxed = (insight: SkillInsight): boolean => insight.stat.level >= MAX_LEVEL

// Each order is a comparison of two skills. Ties keep the order the skills arrived in (the
// hiscores order), because the sort is stable.
const SKILL_ORDERS: Readonly<
  Record<SkillSort, (first: SkillInsight, second: SkillInsight) => number>
> = {
  // most work left first, with the finished skills at the foot whatever their hours say
  hours: (first, second) =>
    Number(isMaxed(first)) - Number(isMaxed(second)) || second.hoursLeft - first.hoursLeft,
  level: (first, second) => first.stat.level - second.stat.level,
  name: (first, second) => skillName(first.skill).localeCompare(skillName(second.skill)),
}

/** The skills in the order the player asked for. */
export function sortSkillInsights(
  insights: readonly SkillInsight[],
  sort: SkillSort,
): SkillInsight[] {
  return [...insights].sort(SKILL_ORDERS[sort])
}

/**
 * How long a skill has left, in the unit it moves in: hours of grinding, days of runs for a
 * skill trained by them, and no figure at all for one that comes with combat. An hours figure
 * says when it is rough, or when it only holds for an ironman who keeps the supplies coming.
 */
export function skillTimeLeftText(insight: SkillInsight, isIronman: boolean): string {
  if (isMaxed(insight)) return 'maxed'
  if (skillDefinition(insight.skill).passive) return 'with combat'
  if (insight.daysLeft) return `${Math.round(insight.daysLeft)} days of runs`
  const hours = formatHours(insight.hoursLeft)
  if (insight.isRough) return `${hours}, rough`
  return isIronman && insight.fastestMethod?.method.usesOwnSupplies
    ? `${hours}, if supplied`
    : hours
}

/** What the "Best now" column says for a skill. */
export function skillBestNowText(insight: SkillInsight): string {
  if (isMaxed(insight)) return ''
  if (skillDefinition(insight.skill).passive) return 'Trained by combat'
  return insight.fastestMethod?.method.name ?? ''
}

/** A skill's line of the Skills table. `xpPerDay` is its pace over the last week; 0 when unknown. */
export function skillRow(insight: SkillInsight, xpPerDay: number, isIronman: boolean): SkillRow {
  const { skill, stat } = insight
  const maxed = isMaxed(insight)
  return {
    skill,
    name: skillName(skill),
    level: stat.level,
    isMaxed: maxed,
    methodLevels: insight.methods.map((option) => option.method.level),
    pace: xpPerDay > 0 ? `+${formatShortNumber(xpPerDay)} a day` : '',
    toMax: maxed ? `${formatShortNumber(stat.xp)} xp` : formatShortNumber(xpToMax(stat)),
    timeLeft: skillTimeLeftText(insight, isIronman),
    bestNow: skillBestNowText(insight),
  }
}

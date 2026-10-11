import type { SavedHiscores } from '#shared/domain/save'
import type { SkillKey } from '#shared/types/skill'
import { forEverySkill, isSkillKey, SKILL_KEYS } from '#shared/data/skills'
import { formatShortNumber } from '#shared/domain/format'

/** One row of Jagex's hiscores JSON. An unranked skill comes back with -1 for its numbers. */
interface HiscoresRow {
  name: string
  level: number
  xp: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isRow = (value: unknown): value is HiscoresRow =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.level === 'number' &&
  typeof value.xp === 'number'

/** 'Overall' is the row of totals; every other row is a skill, named as the game names it. */
const OVERALL = 'overall'

/** Every skill's XP and the total at one moment: what an XP snapshot records. */
export interface XpReading {
  readonly skills: Readonly<Record<SkillKey, number>>
  readonly totalXp: number
}

/**
 * Turns Jagex's hiscores JSON (`{ skills: [{ name, level, xp }, …] }`, as /api/hiscores passes it
 * on) into the shape the app saves. Null when it is not that shape.
 *
 * A skill too low to be ranked is reported as -1 and reads as level 1 with no XP. A skill this
 * app does not know is left out. When the account is too low for an overall rank the totals are
 * added up from the skills instead.
 */
export function parseHiscores(payload: unknown, fetchedAt: number): SavedHiscores | null {
  if (!isRecord(payload) || !Array.isArray(payload.skills)) return null
  const rows = new Map<string, HiscoresRow>()
  for (const row of payload.skills) {
    if (isRow(row)) rows.set(row.name.toLowerCase().replace(/\s+/g, ''), row)
  }
  if (![...rows.keys()].some(isSkillKey)) return null

  const skills = forEverySkill((skill) => {
    const row = rows.get(skill)
    return { level: Math.max(1, row?.level ?? 1), xp: Math.max(0, row?.xp ?? 0) }
  })
  const overall = rows.get(OVERALL)
  const sumOf = (pick: (skill: SkillKey) => number) =>
    SKILL_KEYS.reduce((sum, skill) => sum + pick(skill), 0)
  return {
    fetchedAt,
    skills,
    totalLevel:
      overall && overall.level > 0 ? overall.level : sumOf((skill) => skills[skill].level),
    totalXp: overall && overall.xp > 0 ? overall.xp : sumOf((skill) => skills[skill].xp),
  }
}

/** The reading a snapshot of these stats records. */
export function xpReading(hiscores: SavedHiscores): XpReading {
  return {
    skills: forEverySkill((skill) => hiscores.skills[skill].xp),
    totalXp: hiscores.totalXp,
  }
}

/** How much XP the fresh stats show over the ones before, counting only skills that went up. */
export function xpGainedSince(previous: SavedHiscores, fresh: SavedHiscores): number {
  return SKILL_KEYS.reduce(
    (gained, skill) => gained + Math.max(0, fresh.skills[skill].xp - previous.skills[skill].xp),
    0,
  )
}

/** What the player is told after a refresh that had earlier stats to compare with. */
export function describeStatsUpdate(xpGained: number): string {
  return xpGained > 0
    ? `Stats updated. +${formatShortNumber(xpGained)} XP since last time.`
    : 'Stats updated. Nothing new since last time.'
}

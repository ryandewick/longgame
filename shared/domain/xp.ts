import type { SkillStat } from '../types/skill'

/** The level a skill is maxed at. */
export const MAX_LEVEL = 99

/** XP at level 99: the finish line for every skill. */
export const MAX_XP = 13_034_431

/** The table runs on past 99 because the game does: 126 is the last virtual level. */
const HIGHEST_VIRTUAL_LEVEL = 126

/** XP needed to reach each level, indexed by level. The game's own formula; index 0 is unused. */
const XP_AT_LEVEL: readonly number[] = buildXpTable()

function buildXpTable(): number[] {
  const table = [0, 0]
  let points = 0
  for (let level = 2; level <= HIGHEST_VIRTUAL_LEVEL; level++) {
    points += Math.floor(level - 1 + 300 * Math.pow(2, (level - 1) / 7))
    table.push(Math.floor(points / 4))
  }
  return table
}

/** How much XP does it take to reach this level? */
export function xpForLevel(level: number): number {
  const xp = level >= 1 ? XP_AT_LEVEL[level] : undefined
  if (xp === undefined) {
    throw new RangeError(`No XP figure for level ${level}: levels run from 1 to 126`)
  }
  return xp
}

/** Which level is this much XP? Stops at 99: virtual levels do not count towards max. */
export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level++
  return level
}

/** How much XP until the skill's next level? */
export function xpToNextLevel(stat: SkillStat): number {
  return xpForLevel(stat.level + 1) - stat.xp
}

/** How much XP until the skill reaches 99? */
export function xpToMax(stat: SkillStat): number {
  return Math.max(0, MAX_XP - stat.xp)
}

/** XP still to gain at one level on the way to 99. */
export interface LevelStretch {
  readonly level: number
  readonly xp: number
}

/**
 * How much XP is left to gain at each level between here and 99? Estimates walk these one level
 * at a time, because the best rate changes as methods unlock. Empty once the skill is 99.
 */
export function stretchesToMax(stat: SkillStat): LevelStretch[] {
  const stretches: LevelStretch[] = []
  for (let level = stat.level; level < MAX_LEVEL; level++) {
    // the current level is part done: count from the XP the account has, not from the level's start
    const from = level === stat.level ? stat.xp : xpForLevel(level)
    stretches.push({ level, xp: xpForLevel(level + 1) - from })
  }
  return stretches
}

import type { Account } from '../types/account'
import type { SkillKey } from '../types/skill'
import { FALLBACK_RATE_BANDS, FALLBACK_XP_PER_HOUR } from '../data/fallback-rates'
import { METHODS } from '../data/methods'
import { SKILL_KEYS, skillDefinition } from '../data/skills'
import { bestRateAt, isUsableAt } from './methods'
import { xpPerRunAt } from './rates'
import { MAX_LEVEL, MAX_XP, stretchesToMax, xpForLevel } from './xp'

const MINUTES_PER_DAY = 1440

/**
 * The rate that stands in at a level where no usable method has one: the same for every level,
 * except for a skill that has bands of its own (see data/fallback-rates.ts).
 */
export function fallbackXpPerHour(skill: SkillKey, level: number): number {
  const band = FALLBACK_RATE_BANDS[skill]?.findLast(({ fromLevel }) => fromLevel <= level)
  return band?.xpPerHour ?? FALLBACK_XP_PER_HOUR
}

/**
 * How many hours of grinding until the skill is 99? Each level is taken at the best rate the
 * account could use at that level, so methods that unlock on the way are counted from the level
 * they unlock at. 0 for a maxed or passive skill.
 */
export function hoursLeft(account: Account, skill: SkillKey): number {
  if (skillDefinition(skill).passive) return 0
  let hours = 0
  for (const { level, xp } of stretchesToMax(account.skills[skill])) {
    hours += xp / (bestRateAt(account, skill, level) || fallbackXpPerHour(skill, level))
  }
  return hours
}

/**
 * How many hours of grinding the next `xp` of a skill would take from where the account is, each
 * level at the best rate it could use there, as `hoursLeft` counts them. So it is both what XP
 * from a quest takes off the time to max and what training to a level costs. 0 for a passive
 * skill; XP past 99 takes no time off.
 */
export function hoursForXp(account: Account, skill: SkillKey, xp: number): number {
  if (xp <= 0 || skillDefinition(skill).passive) return 0
  let hours = 0
  let left = xp
  for (const { level, xp: stretch } of stretchesToMax(account.skills[skill])) {
    const taken = Math.min(left, stretch)
    hours += taken / (bestRateAt(account, skill, level) || fallbackXpPerHour(skill, level))
    left -= taken
    if (left <= 0) break
  }
  return hours
}

/** How many hours of grinding until the skill reaches this level: 0 once it has. */
export function hoursToLevel(account: Account, skill: SkillKey, level: number): number {
  return hoursForXp(
    account,
    skill,
    xpForLevel(Math.min(level, MAX_LEVEL)) - account.skills[skill].xp,
  )
}

/**
 * Is the hours figure for this skill built partly on the fallback rate? True when at some level
 * on the way to 99 the account has no rated method it could use.
 */
export function isRoughEstimate(account: Account, skill: SkillKey): boolean {
  if (skillDefinition(skill).passive) return false
  return stretchesToMax(account.skills[skill]).some(
    ({ level }) => !bestRateAt(account, skill, level),
  )
}

/**
 * How much XP a day would the skill's timed runs bring in at this level? Every usable run done
 * once a day, or less often when it takes longer than a day to come round again: the pace a
 * runs skill really moves at.
 */
export function dailyRunXpAt(account: Account, skill: SkillKey, level: number): number {
  let xpPerDay = 0
  for (const method of METHODS[skill]) {
    if (!method.timedRun?.xpPerRun || !isUsableAt(account, method, level)) continue
    const everyMinutes = method.timedRun.everyMinutes || MINUTES_PER_DAY
    xpPerDay += xpPerRunAt(method, level, account) * Math.min(1, MINUTES_PER_DAY / everyMinutes)
  }
  return xpPerDay
}

/**
 * How many days of runs until a skill trained by timed runs is 99? 0 for any other skill, for a
 * maxed one, and when there is a level on the way at which the account has no run to do.
 */
export function daysLeft(account: Account, skill: SkillKey): number {
  if (!skillDefinition(skill).daily) return 0
  let days = 0
  for (const { level, xp } of stretchesToMax(account.skills[skill])) {
    const xpPerDay = dailyRunXpAt(account, skill, level)
    if (!xpPerDay) return 0
    days += xp / xpPerDay
  }
  return days
}

/** How far the whole account is from maxing. */
export interface MaxProgress {
  /** XP banked as a share of the XP of every skill at 99, 0 to 100. XP past 99 does not count. */
  readonly percent: number
  readonly xp: number
  /** Levels still to gain across every skill. */
  readonly levelsLeft: number
  /** Hours of grinding left across every skill that is not yet 99. */
  readonly hoursLeft: number
  readonly skillsMaxed: number
  readonly skillCount: number
}

/** How far is the account from maxing every skill? */
export function maxProgress(account: Account): MaxProgress {
  let xp = 0
  let levelsLeft = 0
  let hours = 0
  let skillsMaxed = 0
  for (const skill of SKILL_KEYS) {
    const stat = account.skills[skill]
    xp += Math.min(stat.xp, MAX_XP)
    levelsLeft += MAX_LEVEL - Math.min(MAX_LEVEL, stat.level)
    if (stat.level >= MAX_LEVEL) skillsMaxed++
    else hours += hoursLeft(account, skill)
  }
  return {
    percent: (xp / (SKILL_KEYS.length * MAX_XP)) * 100,
    xp,
    levelsLeft,
    hoursLeft: hours,
    skillsMaxed,
    skillCount: SKILL_KEYS.length,
  }
}

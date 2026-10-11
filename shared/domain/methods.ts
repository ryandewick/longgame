import type { Account } from '../types/account'
import type { Intensity, Method } from '../types/method'
import type { MissingRequirement } from '../types/requirement'
import type { Mood } from '../types/session'
import type { SkillKey } from '../types/skill'
import { METHODS } from '../data/methods'
import { skillDefinition } from '../data/skills'
import { isIronman } from './account'
import { meetsRequirements, missingRequirements } from './requirements'
import { xpPerHourAt, xpPerRunAt } from './rates'

/** A method as one account sees it today. */
export interface MethodOption {
  readonly method: Method
  /** XP an hour at the account's current level in the skill. */
  readonly xpPerHour: number
  /** XP from one run at the current level, to the nearest whole XP; 0 unless it is a timed run. */
  readonly xpPerRun: number
  /** What the account lacks, apart from the level itself. */
  readonly missing: readonly MissingRequirement[]
  /** The level is reached and nothing is missing. */
  readonly unlocked: boolean
}

/**
 * Every method of a skill as the account sees it, in the data's order. Ironman-only routes are
 * hidden from a main; methods that need the Grand Exchange stay visible to an ironman, marked
 * as missing it, so the list explains itself.
 */
export function methodOptions(account: Account, skill: SkillKey): MethodOption[] {
  const level = account.skills[skill].level
  const ironman = isIronman(account)
  return METHODS[skill]
    .filter((method) => method.audience !== 'iron' || ironman)
    .map((method) => {
      const missing = missingRequirements(account, method.requirements)
      if (method.audience === 'main' && ironman) missing.push({ kind: 'grand-exchange' })
      return {
        method,
        xpPerHour: xpPerHourAt(method, level, account),
        xpPerRun: Math.round(xpPerRunAt(method, level, account)),
        missing,
        unlocked: method.level <= level && missing.length === 0,
      }
    })
}

/**
 * On a budget, expensive methods are left out, unless that would leave nothing at all.
 * An ironman has no budget to speak of: nothing is bought.
 */
export function withinBudget(
  account: Account,
  options: readonly MethodOption[],
): readonly MethodOption[] {
  if (isIronman(account) || account.preferences.budget !== 'cheap') return options
  const affordable = options.filter((option) => option.method.cost !== 'pricey')
  return affordable.length ? affordable : options
}

/** Tick-perfect methods are only offered to a player who has asked for them. */
export function suitsTickPreference(account: Account, method: Method): boolean {
  return account.preferences.tickPerfect || !method.tickPerfect
}

/**
 * What could a session block in this skill be? Something to grind right now, so never a timed
 * run and never a passive skill. Where the wiki rates none of the unlocked methods, the last one
 * unlocked stands in, so the skill can still be dealt.
 */
export function grindableMethods(
  account: Account,
  skill: SkillKey,
  options: readonly MethodOption[] = methodOptions(account, skill),
): readonly MethodOption[] {
  if (skillDefinition(skill).passive) return []
  const open = options.filter(
    (option) =>
      option.unlocked && !option.method.timedRun && suitsTickPreference(account, option.method),
  )
  const rated = open.filter((option) => option.xpPerHour > 0)
  return withinBudget(account, rated.length ? rated : open.slice(-1))
}

/** How much a method is worth to an ironman, who has to gather its supplies first. */
export function supplyFactor(account: Account, method: Method): number {
  return isIronman(account) && method.usesOwnSupplies ? 0.6 : 1
}

/** How strongly each mood leans towards each intensity when choosing a skill's best method. */
const MOOD_LEANING: Readonly<Record<Mood, Readonly<Record<Intensity, number>>>> = {
  afk: { afk: 2.2, semi: 1.4, active: 0.6 },
  active: { afk: 0.7, semi: 1, active: 1.3 },
  balanced: { afk: 1.25, semi: 1.1, active: 1 },
}

/**
 * Which grindable method suits the mood best? XP an hour, leaning towards the mood's intensity
 * and away from methods an ironman has to supply. Null when the skill has nothing to grind.
 */
export function bestMethod(
  account: Account,
  skill: SkillKey,
  mood: Mood,
  options: readonly MethodOption[] = methodOptions(account, skill),
): MethodOption | null {
  const score = (option: MethodOption) =>
    supplyFactor(account, option.method) *
    option.xpPerHour *
    MOOD_LEANING[mood][option.method.intensity]
  const ranked = [...grindableMethods(account, skill, options)].sort(
    (first, second) => score(second) - score(first),
  )
  return ranked[0] ?? null
}

/**
 * What is the fastest thing the account can do in this skill? What the skill and method lists
 * call best. Timed runs count for a skill that is trained by them. Null for a passive skill.
 */
export function fastestMethod(
  account: Account,
  skill: SkillKey,
  options: readonly MethodOption[] = methodOptions(account, skill),
): MethodOption | null {
  const definition = skillDefinition(skill)
  if (definition.passive) return null
  const rated = withinBudget(
    account,
    options.filter(
      (option) =>
        option.unlocked &&
        option.xpPerHour > 0 &&
        suitsTickPreference(account, option.method) &&
        (definition.daily || !option.method.timedRun),
    ),
  )
  const fastest = [...rated].sort((first, second) => second.xpPerHour - first.xpPerHour)[0]
  // nothing rated: fall back to the one unrated method a block would use
  return fastest ?? grindableMethods(account, skill, options)[0] ?? null
}

/**
 * Which rated method does the account unlock next? The lowest-level one it cannot use yet,
 * whether it is waiting on a level, a quest or a diary. Null when everything is open.
 */
export function nextUnlock(
  account: Account,
  skill: SkillKey,
  options: readonly MethodOption[] = methodOptions(account, skill),
): MethodOption | null {
  const locked = options.filter(
    (option) =>
      !option.unlocked &&
      option.xpPerHour > 0 &&
      suitsTickPreference(account, option.method) &&
      // an ironman never unlocks a method that needs the Grand Exchange
      !(isIronman(account) && option.method.audience === 'main'),
  )
  // the list is already in level order; sorting again keeps that true if the data's order changes
  return locked.sort((first, second) => first.method.level - second.method.level)[0] ?? null
}

/**
 * Could the account use this method if its skill were at this level? Everything else about the
 * account, quests and other skills included, is taken as it is today.
 */
export function isUsableAt(account: Account, method: Method, level: number): boolean {
  if (method.level > level || !suitsTickPreference(account, method)) return false
  const ironman = isIronman(account)
  if (method.audience === 'iron' ? !ironman : method.audience === 'main' && ironman) return false
  // unlike a method list, an estimate on a budget never falls back to an expensive method
  if (!ironman && account.preferences.budget === 'cheap' && method.cost === 'pricey') return false
  return meetsRequirements(account, method.requirements, { skill: method.skill, level })
}

/**
 * What is the best XP an hour the account could get in this skill at this level? 0 when no
 * usable method has a rate. Timed runs only count for a skill that is trained by them.
 */
export function bestRateAt(account: Account, skill: SkillKey, level: number): number {
  const countsRuns = skillDefinition(skill).daily
  let best = 0
  for (const method of METHODS[skill]) {
    if (method.timedRun && !countsRuns) continue
    const rate = xpPerHourAt(method, level, account)
    if (rate > best && isUsableAt(account, method, level)) best = rate
  }
  return best
}

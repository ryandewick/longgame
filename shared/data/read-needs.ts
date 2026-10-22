import type { LevelNeed } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { isSkillKey } from './skills'
import type { LevelSource } from './sources'

/*
 * Checks shared by the quest and diary facts builders, for the parts of a need the two files
 * write the same way. Each adds what is wrong to `problems`, prefixed with where it was found,
 * and hands back what can be used.
 */

/** A real skill level: a whole number from 1 to 99. */
export const isLevel = (level: number): boolean =>
  Number.isInteger(level) && level >= 1 && level <= 99

/** A count a fact may leave out: 0 when it does, otherwise a whole number above 0. */
export function readCount(
  problems: string[],
  where: string,
  field: string,
  value: number | undefined,
): number {
  if (value === undefined) return 0
  if (Number.isInteger(value) && value > 0) return value
  problems.push(`${where}: ${field} ${value}`)
  return 0
}

/** A skill at a level, or null (with the problem noted) when either is not a real one. */
export function readLevelNeed(
  problems: string[],
  where: string,
  source: LevelSource,
): LevelNeed | null {
  if (!isSkillKey(source.skill)) {
    problems.push(`${where}: unknown skill '${source.skill}'`)
    return null
  }
  if (!isLevel(source.level)) {
    problems.push(`${where}: ${source.skill} ${source.level}`)
    return null
  }
  return { skill: source.skill, level: source.level }
}

/** Skills named in a list about the levels just read: each a real skill with a level there, once. */
export function readSkillList(
  problems: string[],
  where: string,
  field: string,
  list: readonly string[] | undefined,
  levels: Readonly<Partial<Record<SkillKey, number>>>,
): SkillKey[] {
  const skills: SkillKey[] = []
  for (const skill of list ?? []) {
    if (!isSkillKey(skill)) problems.push(`${where}: ${field} names unknown skill '${skill}'`)
    else if (levels[skill] === undefined)
      problems.push(`${where}: ${field} names ${skill}, which it needs no level in`)
    else if (skills.includes(skill)) problems.push(`${where}: ${field} names ${skill} twice`)
    else skills.push(skill)
  }
  return skills
}

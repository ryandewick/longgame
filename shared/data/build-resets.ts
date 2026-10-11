import type { CadenceStep, Reset, ResetSchedule } from '../types/reset'
import { parseRequirements, requirementProblems } from '../domain/requirements'
import { isSkillKey } from './skills'
import { DataSourceError } from './sources'
import type { ResetSource } from './sources'

function buildSchedule(
  source: ResetSource,
  where: string,
  problems: string[],
): ResetSchedule | null {
  const { every, skill } = source
  if (every === 'utc') return { kind: 'utc-midnight' }
  if (every === 'weekly') return { kind: 'weekly' }
  if (typeof every === 'number' && Number.isInteger(every) && every > 0) {
    return { kind: 'interval', minutes: every }
  }
  if (Array.isArray(every) && every.length > 0) {
    // the steps are read against a skill level, so the reset has to say which skill
    if (!skill || !isSkillKey(skill)) {
      problems.push(`${where}: a cadence by level needs a skill`)
      return null
    }
    const steps: CadenceStep[] = []
    for (const step of every) {
      const [fromLevel, minutes] = step
      if (step.length !== 2 || fromLevel === undefined || minutes === undefined) {
        problems.push(`${where}: every ${JSON.stringify(every)}`)
        return null
      }
      steps.push({ fromLevel, minutes })
    }
    return { kind: 'by-level', skill, steps }
  }
  problems.push(`${where}: every ${JSON.stringify(every)}`)
  return null
}

/**
 * Turns the reset sources into resets, in source order: the order the Resets page lists them
 * and the order the planner takes due ones in.
 * Throws a DataSourceError listing everything wrong with the source.
 */
export function buildResets(sources: readonly ResetSource[]): Reset[] {
  const problems: string[] = []
  const resets: Reset[] = []

  for (const source of sources) {
    const where = `reset ${source.k}`
    const schedule = buildSchedule(source, where, problems)
    const requirementText = source.req ?? ''
    for (const problem of requirementProblems(requirementText)) {
      problems.push(`${where}: ${problem}`)
    }
    if (source.skill && !isSkillKey(source.skill)) {
      problems.push(`${where}: unknown skill '${source.skill}'`)
    }
    if (!schedule) continue

    resets.push({
      key: source.k,
      name: source.n,
      schedule,
      skill: source.skill && isSkillKey(source.skill) ? source.skill : null,
      requirements: parseRequirements(requirementText),
      note: source.note,
      source: source.src ?? '',
      audience: source.who === 'main' || source.who === 'iron' ? source.who : 'both',
    })
  }

  if (problems.length) throw new DataSourceError(problems)
  return resets
}

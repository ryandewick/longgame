import type { Boost, BoostRule } from '../types/boost'
import type { SkillKey } from '../types/skill'
import { readLevelNeed } from './read-needs'
import { isSkillKey } from './skills'
import { DataSourceError } from './sources'
import type { BoostRuleSource, BoostSource } from './sources'

const isWhole = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value > 0

/** Who may count a boost, or null (with the problem noted) when the rule is not one. */
function boostRule(problems: string[], where: string, rule: BoostRuleSource): BoostRule | null {
  if (typeof rule === 'object') return readLevelNeed(problems, where, rule)
  if (rule === 'always' || rule === 'never') return rule
  problems.push(`${where}: a rule '${rule}'`)
  return null
}

/**
 * Turns datasrc/boosts.json into the app's boosts, by skill. Every field is checked: skills the
 * app knows, a name, a phrase, a page and revision, a size that is either flat or a base and a
 * share of the level, and rules that are 'always', 'never' or a real level.
 *
 * Throws a DataSourceError listing everything wrong with the source.
 */
export function buildBoosts(
  source: Readonly<Record<string, readonly BoostSource[]>>,
): Readonly<Partial<Record<SkillKey, readonly Boost[]>>> {
  const problems: string[] = []
  const boosts: Partial<Record<SkillKey, Boost[]>> = {}

  for (const [skill, list] of Object.entries(source)) {
    if (!isSkillKey(skill)) {
      problems.push(`'${skill}': not a skill the app knows`)
      continue
    }
    boosts[skill] = list.flatMap((boost) => {
      const where = `${skill}: ${boost.name}`
      if (!boost.name.trim() || !boost.phrase.trim()) problems.push(`${where}: no name or phrase`)
      if (!boost.page.trim() || !(Number.isInteger(boost.rev) && boost.rev > 0))
        problems.push(`${where}: page '${boost.page}' revision ${boost.rev}`)
      const flat = isWhole(boost.flat)
      const share = isWhole(boost.base) && isWhole(boost.percent)
      if (flat === share || (flat && (boost.base ?? boost.percent) !== undefined)) {
        problems.push(`${where}: a size that is not flat or a base and a share`)
        return []
      }
      const main = boostRule(problems, `${where} main`, boost.main)
      const ironman = boostRule(problems, `${where} ironman`, boost.ironman)
      if (!main || !ironman) return []
      return [
        {
          name: boost.name,
          phrase: boost.phrase,
          page: boost.page,
          revision: boost.rev,
          amount:
            flat && boost.flat !== undefined
              ? { flat: boost.flat }
              : { base: boost.base ?? 0, percentOfLevel: boost.percent ?? 0 },
          main,
          ironman,
        },
      ]
    })
  }

  if (problems.length) throw new DataSourceError(problems.map((problem) => `boosts: ${problem}`))
  return boosts
}

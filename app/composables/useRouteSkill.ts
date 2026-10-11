import type { SkillKey } from '#shared/types/skill'
import { isSkillKey } from '#shared/data/skills'

/**
 * The skill named in the address, for the pages that take one (/skills/mining, /methods/mining).
 * Null when the address names none.
 */
export function useRouteSkill(): ComputedRef<SkillKey | null> {
  const route = useRoute()
  return computed(() => {
    const { skill } = route.params
    return typeof skill === 'string' && isSkillKey(skill) ? skill : null
  })
}

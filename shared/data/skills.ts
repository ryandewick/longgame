import type { SkillCategory, SkillDefinition, SkillKey } from '../types/skill'

const skill = (
  key: SkillKey,
  name: string,
  category: SkillCategory,
  flags: { passive?: boolean; daily?: boolean } = {},
): SkillDefinition => ({
  key,
  name,
  category,
  passive: flags.passive ?? false,
  daily: flags.daily ?? false,
})

/** Every skill, in hiscores order. */
export const SKILLS: readonly SkillDefinition[] = [
  skill('attack', 'Attack', 'combat'),
  skill('defence', 'Defence', 'combat'),
  skill('strength', 'Strength', 'combat'),
  // Hitpoints comes with every point of combat damage, so it has no methods and is never dealt.
  skill('hitpoints', 'Hitpoints', 'combat', { passive: true }),
  skill('ranged', 'Ranged', 'combat'),
  skill('prayer', 'Prayer', 'combat'),
  skill('magic', 'Magic', 'combat'),
  skill('cooking', 'Cooking', 'artisan'),
  skill('woodcutting', 'Woodcutting', 'gather'),
  skill('fletching', 'Fletching', 'artisan'),
  skill('fishing', 'Fishing', 'gather'),
  skill('firemaking', 'Firemaking', 'artisan'),
  skill('crafting', 'Crafting', 'artisan'),
  skill('smithing', 'Smithing', 'artisan'),
  skill('mining', 'Mining', 'gather'),
  skill('herblore', 'Herblore', 'artisan'),
  skill('agility', 'Agility', 'support'),
  skill('thieving', 'Thieving', 'support'),
  skill('slayer', 'Slayer', 'support'),
  // Farming moves at the pace of its timed runs, so its time left is counted in days of runs.
  skill('farming', 'Farming', 'gather', { daily: true }),
  skill('runecraft', 'Runecraft', 'artisan'),
  skill('hunter', 'Hunter', 'gather'),
  skill('construction', 'Construction', 'artisan'),
  skill('sailing', 'Sailing', 'support'),
]

/** Every skill key, in hiscores order. */
export const SKILL_KEYS: readonly SkillKey[] = SKILLS.map((definition) => definition.key)

const definitionsByKey = new Map<string, SkillDefinition>(
  SKILLS.map((definition) => [definition.key, definition]),
)

/** Is this string one of the 24 skill keys? */
export function isSkillKey(value: string): value is SkillKey {
  return definitionsByKey.has(value)
}

/** The name, category and flags of a skill. */
export function skillDefinition(key: SkillKey): SkillDefinition {
  const definition = definitionsByKey.get(key)
  if (!definition) throw new Error(`No definition for skill '${key}'`)
  return definition
}

/** A skill's name as the game writes it: 'Runecraft'. */
export function skillName(key: SkillKey): string {
  return skillDefinition(key).name
}

/** Builds a value for every skill: the way to make a complete `Record<SkillKey, …>`. */
export function forEverySkill<Value>(valueFor: (key: SkillKey) => Value): Record<SkillKey, Value> {
  return Object.fromEntries(SKILL_KEYS.map((key) => [key, valueFor(key)])) as Record<
    SkillKey,
    Value
  >
}

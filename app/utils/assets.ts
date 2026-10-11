import type { SkillKey } from '#shared/types/skill'

/** Where the game's art is served from. It belongs to Jagex and is used under its Fan Content Policy. */
const GAME_ASSETS = '/assets/osrs'

/**
 * The picture of a skillcape, or of the max cape when no skill is given. `trimmed` is the cape a
 * player wears once they hold a second 99; the rack shows it for a maxed skill.
 */
export function capeImageUrl(skill: SkillKey | null, trimmed = false): string {
  if (!skill) return `${GAME_ASSETS}/capes-md/max.webp`
  return `${GAME_ASSETS}/capes-md/${skill}${trimmed ? '_t' : ''}.webp`
}

/** A skill's icon as the game draws it in the skills tab. */
export function skillIconUrl(skill: SkillKey): string {
  return `${GAME_ASSETS}/icons/${skill}.png`
}

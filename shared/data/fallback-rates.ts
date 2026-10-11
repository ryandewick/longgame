import type { RateBand } from '../types/method'
import type { SkillKey } from '../types/skill'

/**
 * Stands in for a level where no usable method has a rate, so the hours still add up to
 * something. Any estimate built on it is flagged as rough.
 */
export const FALLBACK_XP_PER_HOUR = 40_000

/**
 * The skills whose stand-in rises with level instead of being the flat figure.
 *
 * Slayer is the one skill where no source rates the things the data lists: XP an hour follows the
 * account's combat stats and the tasks it is given, not the master who gives them, so most
 * masters have no rate and the stand-in decides almost the whole estimate. The flat figure made
 * levels 1 to 50 read as two and a half hours.
 *
 * These are the all-in Slayer rates of the ironman efficiency table (Wise Old Man and TempleOSRS
 * agree; read 11 October 2026), which count the time between tasks, up to level 80. From 80 they
 * are held to what the data gives Duradel without a cannon, so no master ever reads as faster
 * than the best one. The table is for efficient play, so for most accounts they are still
 * generous at low levels.
 */
export const FALLBACK_RATE_BANDS: Partial<Record<SkillKey, readonly RateBand[]>> = {
  slayer: [
    { fromLevel: 1, xpPerHour: 5_000 },
    { fromLevel: 50, xpPerHour: 16_000 },
    { fromLevel: 60, xpPerHour: 21_000 },
    { fromLevel: 65, xpPerHour: 23_500 },
    { fromLevel: 75, xpPerHour: 24_200 },
    { fromLevel: 80, xpPerHour: 27_000 },
    { fromLevel: 93, xpPerHour: 28_500 },
  ],
}

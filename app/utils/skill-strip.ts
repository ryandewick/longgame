import { capeFillPercent } from '#shared/domain/capes'
import { MAX_LEVEL } from '#shared/domain/xp'

/** A method unlock marked on a skill's strip. */
export interface SkillStripStop {
  readonly level: number
  /** Where the stop sits along the strip, 0 to 100. */
  readonly position: number
  /** The skill has reached this level. */
  readonly reached: boolean
}

/** A skill drawn as a line from 1 to 99. */
export interface SkillStrip {
  /** Where the skill's own level sits along the strip, 0 to 100. */
  readonly position: number
  /** One stop per level at which a method unlocks, lowest first. */
  readonly stops: readonly SkillStripStop[]
  /** What the strip says to someone who cannot see it. */
  readonly label: string
}

/** A level's place along the strip, to the hundredth of a percent a style needs. */
function positionOf(level: number): number {
  return Number(capeFillPercent(level).toFixed(2))
}

/**
 * The strip for a skill at `level` whose methods open at `methodLevels`. Methods that share a
 * level share a stop, and the two ends of the strip (1 and 99) are never stops: every skill
 * starts at one and finishes at the other.
 */
export function skillStrip(level: number, methodLevels: readonly number[]): SkillStrip {
  const stopLevels = [...new Set(methodLevels)]
    .filter((methodLevel) => methodLevel > 1 && methodLevel < MAX_LEVEL)
    .sort((first, second) => first - second)
  const stops = stopLevels.map((stopLevel) => ({
    level: stopLevel,
    position: positionOf(stopLevel),
    reached: stopLevel <= level,
  }))
  const unlocksAhead = stops.filter((stop) => !stop.reached).length
  return {
    position: positionOf(level),
    stops,
    label: `Level ${level} of ${MAX_LEVEL}, ${unlocksAhead} method unlocks ahead`,
  }
}

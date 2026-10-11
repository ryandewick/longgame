import type { Account, AccountType, Budget } from '#shared/types/account'
import type { Method } from '#shared/types/method'
import type { SkillKey } from '#shared/types/skill'
import { forEverySkill } from '#shared/data/skills'
import { NO_REQUIREMENTS } from '#shared/domain/requirements'
import { xpForLevel } from '#shared/domain/xp'

interface AccountSketch {
  type?: AccountType
  /** Every skill not named in `levels` is at this level. */
  everySkill?: number
  levels?: Partial<Record<SkillKey, number>>
  quests?: string[]
  diaries?: string[]
  allQuests?: boolean
  allDiaries?: boolean
  budget?: Budget
  tickPerfect?: boolean
  excluded?: SkillKey[]
}

/**
 * An account for a test: level 1 everywhere unless the sketch says otherwise, with each skill at
 * exactly the XP its level starts at.
 */
export function accountWith(sketch: AccountSketch = {}): Account {
  return {
    type: sketch.type ?? 'main',
    skills: forEverySkill((skill) => {
      const level = sketch.levels?.[skill] ?? sketch.everySkill ?? 1
      return { level, xp: xpForLevel(level) }
    }),
    completedQuests: new Set(sketch.quests),
    completedDiaries: new Set(sketch.diaries),
    allQuests: sketch.allQuests ?? false,
    allDiaries: sketch.allDiaries ?? false,
    preferences: {
      budget: sketch.budget ?? 'any',
      tickPerfect: sketch.tickPerfect ?? false,
      excludedSkills: new Set(sketch.excluded),
    },
  }
}

/** A method for a test: free, active, level 1 Mining at 10,000 XP an hour unless told otherwise. */
export function methodWith(overrides: Partial<Method> = {}): Method {
  return {
    skill: 'mining',
    level: 1,
    name: 'Test method',
    xpPerHour: 10_000,
    intensity: 'active',
    cost: 'free',
    requirements: NO_REQUIREMENTS,
    note: '',
    source: 'Test',
    audience: 'both',
    usesOwnSupplies: false,
    tickPerfect: false,
    questSkip: false,
    perTripSetup: false,
    ...overrides,
  }
}

/** A repeatable stand-in for Math.random. */
export function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

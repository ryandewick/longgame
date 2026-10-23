import type { Account, AccountType, Budget } from '#shared/types/account'
import type { DiaryFacts } from '#shared/types/diary'
import type { Method } from '#shared/types/method'
import type { QuestFacts } from '#shared/types/quest'
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
  /** Quests started and not finished. */
  started?: string[]
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
    startedQuests: new Set(sketch.started),
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

/**
 * A fresh account for a test: 10 Hitpoints (1,154 XP), the only skill a player starts with XP in,
 * and 1 elsewhere, unless the sketch says otherwise. `blankAccount()` is not one: it means "not
 * looked up yet", level 1 everywhere.
 */
export function freshAccount(sketch: AccountSketch = {}): Account {
  return accountWith({ ...sketch, levels: { hitpoints: 10, ...sketch.levels } })
}

/** The facts of a plain quest for a test: no levels, no quests before it, nothing needed or given. */
export function questFactsWith(name: string, overrides: Partial<QuestFacts> = {}): QuestFacts {
  return {
    name,
    kind: 'quest',
    page: name,
    revision: 1,
    levels: {},
    requires: [],
    requiresStarted: [],
    optional: false,
    doneByEveryAccount: false,
    startedMatters: false,
    needs: {
      boostable: [],
      finishOnly: [],
      bypassable: [],
      questPoints: 0,
      combat: 0,
      kudos: 0,
      ironman: [],
    },
    gives: { questPoints: 0, kudos: 0, kudosOpened: 0, xpChoices: [], xpDuring: {} },
    time: {
      minutes: { low: 10, mid: 15, high: 20 },
      ironmanMinutes: 0,
      waitMinutes: 0,
      ironmanWaitMinutes: 0,
    },
    guide: { main: null, ironman: null },
    ...overrides,
  }
}

/** The facts of a diary tier for a test ('Varrock Hard'): it needs nothing unless told otherwise. */
export function diaryFactsWith(name: string, overrides: Partial<DiaryFacts> = {}): DiaryFacts {
  const tier = name.split(' ').at(-1) ?? ''
  return {
    name,
    region: name.slice(0, -tier.length - 1),
    tier,
    page: `${name.slice(0, -tier.length - 1)} Diary`,
    revision: 1,
    quests: {},
    planFinished: [],
    levels: {},
    boostable: [],
    raiments: null,
    choices: [],
    questPoints: 0,
    combat: 0,
    kudos: 0,
    allQuests: false,
    ironman: [],
    longTasks: [],
    also: [],
    gates: [],
    minutes: { low: 10, mid: 15, high: 20 },
    items: [],
    lamp: null,
    recommended: false,
    ...overrides,
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
    inWilderness: false,
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

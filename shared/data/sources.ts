/*
 * The shapes of the JSON files in datasrc/, which are written by hand and by the wiki scrapers.
 * Nothing here is trusted: the builders check every field before it becomes part of the app's data.
 */

/** One entry of datasrc/methods/<skill>.json. */
export interface MethodSource {
  /** The level the method opens at. */
  lv: number
  name: string
  /** 'both', 'main' or 'iron'. */
  who: string
  /** 'afk', 'semi' or 'active'. */
  int: string
  /** 'profit', 'free', 'cheap' or 'pricey'. */
  cost: string
  /** XP an hour; 0 when the wiki gives none. Overridden by the first of `bands`. */
  xph: number
  /** A requirement string: see domain/requirements.ts. */
  req: string
  /** A timed run, with `per` XP a run and `every` minutes between runs. */
  run: boolean
  /** An ironman has to bring their own supplies. */
  supply: boolean
  note: string
  /** The wiki page the figures came from. */
  src: string
  /** [level, XP an hour] steps as the rate rises. */
  bands?: number[][]
  /** The name of a rate worked out from the account's levels. */
  calc?: string
  /** The rate is an estimate. */
  est?: boolean
  /** Each trip needs setting up. */
  setup?: boolean
  per?: number
  every?: number
}

/** datasrc/methods/<skill>.json. */
export interface MethodSourceFile {
  skill: string
  methods: MethodSource[]
}

/** datasrc/quests_set.json: fixed quest XP parsed from the wiki's "Quest experience rewards". */
export interface FixedQuestXpSource {
  /** Quest name to XP by skill. */
  xp: Record<string, Record<string, number>>
  /** Quest name to the skill levels it needs. */
  need: Record<string, Record<string, number>>
  /** The names in `xp` that are miniquests. */
  mini: string[]
}

/** One entry of datasrc/quests_lamps.json: a skill-choice reward, as the wiki's Lua writes it. */
export interface LampSource {
  name: string
  /** 'XP, count', for example '2500, 2'. */
  rewards: string
  /** A minimum level, a quoted list of skills, or 'None' in quotes. */
  restrictions: string
  /** Lua source naming the skill levels the quest needs. */
  requirements: string | null
  notes: string | null
}

/**
 * One entry of datasrc/quest_prerequisites.json, which is keyed by the wiki's name for the quest.
 * Most are the wiki's Module:Questreq/data, entry for entry: quests, miniquests, activities and
 * diaries alike. The quests that module has no entry for were read from their own pages.
 */
export interface QuestPrerequisiteSource {
  /** The wiki page the entry came from: 'Module:Questreq/data', or the quest's own page. */
  src: string
  /** What it requires: quest names, some marked 'Started:' when finishing is not needed. */
  requires: string[]
}

/** The page most entries of datasrc/quest_prerequisites.json came from. */
export const QUEST_PREREQUISITE_MODULE = 'Module:Questreq/data'

/** One entry of datasrc/resets.json. */
export interface ResetSource {
  k: string
  n: string
  /** Minutes, 'utc', 'weekly', or [level, minutes] steps keyed on `skill`. */
  every: number | string | number[][]
  skill?: string
  req?: string
  note: string
  src?: string
  who?: string
}

/** Raised when datasrc/ holds something the app cannot use. Lists every problem, not only one. */
export class DataSourceError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(`datasrc has ${problems.length} problem(s):\n` + problems.join('\n'))
    this.name = 'DataSourceError'
    this.problems = problems
  }
}

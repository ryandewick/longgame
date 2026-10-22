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
  /** It is done in the Wilderness, where other players can attack. */
  wild?: boolean
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
}

/** A lamp in datasrc/quest_facts.json: the Varrock Museum's, which the lamp table does not list. */
export interface QuestFactLampSource {
  count: number
  xp: number
  /** The level the chosen skill must be at. */
  minLevel: number
  /** Who hands it over: 'Historian Minas'. */
  from: string
}

/**
 * One entry of datasrc/quest_facts.json, keyed by the app's name for it. The file is exported from
 * the quest and diary research (release/research/quests), never written by hand.
 */
export interface QuestFactSource {
  /** 'quest', 'subquest', 'miniquest' or 'activity'. */
  kind: string
  /** The wiki page the facts were read from, and its revision. */
  page: string
  rev: number
  /** Skill to level, as its page lists them. */
  levels?: Record<string, number>
  /** The quests its page says must be finished first. */
  requires?: string[]
  /** The quests one of its levels proves: Druidic Ritual, without which there is no Herblore. */
  implies?: string[]
  lamps?: QuestFactLampSource[]
  /** A miniquest that no quest and no diary task needs. */
  optional?: boolean
  /** Every account has done it. */
  everyAccount?: boolean
}

/** One entry of datasrc/quests_lamps.json: a skill-choice reward, as the wiki's Lua writes it. */
export interface LampSource {
  name: string
  /** 'XP, count', for example '2500, 2'. */
  rewards: string
  /** A minimum level, a quoted list of skills, or 'None' in quotes. */
  restrictions: string
  /**
   * Lua source naming skill levels. Not read: it also counts the levels of the quests a quest
   * requires, and optional ones. `need` holds a quest's own.
   */
  requirements: string | null
  notes: string | null
}

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

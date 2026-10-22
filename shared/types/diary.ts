import type { LevelNeed, QuestState } from './quest'
import type { SkillKey } from './skill'

/** One thing an either-or choice of a tier can be met with. */
export type ChoiceItem =
  | {
      readonly kind: 'skill'
      readonly skill: SkillKey
      readonly level: number
      readonly boostable: boolean
    }
  | { readonly kind: 'quest'; readonly quest: string; readonly state: QuestState }
  | { readonly kind: 'combat'; readonly level: number }
  /** Something the app cannot check, in words: 'a cooked oomlie wrap'. */
  | { readonly kind: 'other'; readonly text: string }

/** An either-or need: one of the options, each a set of items that go together. */
export interface NeedChoice {
  readonly options: readonly (readonly ChoiceItem[])[]
  /** Why there is a choice, in words, when the research gives a reason; otherwise null. */
  readonly note: string | null
}

/** A count to build up for a task: 1,000 chompy kills. Offered as its own long task. */
export interface LongTask {
  readonly amount: number
  /** What is counted: 'chompy or jubbly bird kills'. */
  readonly unit: string
  /** The task in words. */
  readonly text: string
}

/** A training method or a reset that a tier's reward opens up. */
export interface DiaryGate {
  readonly kind: 'method' | 'reset'
  readonly name: string
}

/**
 * What the app knows about one achievement diary tier, from datasrc/diary_facts.json. Later stages
 * add the time its tasks take and what its reward is worth.
 */
export interface DiaryFacts {
  /** Region and tier, as requirement strings and ticks name it: 'Ardougne Medium'. */
  readonly name: string
  readonly region: string
  /** 'Easy', 'Medium', 'Hard' or 'Elite'. */
  readonly tier: string
  /** The wiki page the facts were read from, and the revision read. */
  readonly page: string
  readonly revision: number
  /**
   * The quests its tasks need, each finished or only started, as the tier's page reads them. A
   * tier whose reward is claimed has had every task done, so it proves each of these at least that
   * far.
   */
  readonly quests: Readonly<Record<string, QuestState>>
  /**
   * The quests to plan on finished although the page reads them started: where the page says a
   * partly done quest is enough and other sources ask for it finished (decision 4).
   */
  readonly planFinished: readonly string[]
  /** The skill levels its tasks need, the safe reading. */
  readonly levels: Readonly<Partial<Record<SkillKey, number>>>
  /** The skills whose level may be met with a boost. */
  readonly boostable: readonly SkillKey[]
  /**
   * A lower Runecraft level that is enough with this many Raiments of the Eye pieces, or null.
   * Shown beside the level and never counted (decision 5): the app cannot see what an account owns.
   */
  readonly raiments: { readonly level: number; readonly pieces: number } | null
  readonly choices: readonly NeedChoice[]
  /** Quest points, combat level and Kudos needed; 0 for none. */
  readonly questPoints: number
  readonly combat: number
  readonly kudos: number
  /** It needs every quest done (Lumbridge & Draynor Elite: the quest point cape). */
  readonly allQuests: boolean
  /** Levels an ironman needs for it that a main does not. */
  readonly ironman: readonly LevelNeed[]
  readonly longTasks: readonly LongTask[]
  /** What else it needs that the app cannot check, in words: 'Access to the Nature Altar'. */
  readonly also: readonly string[]
  /** The methods and resets its reward opens up. */
  readonly gates: readonly DiaryGate[]
}

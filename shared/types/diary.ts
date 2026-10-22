import type { QuestState } from './quest'

/**
 * What the app knows about one achievement diary tier, from datasrc/diary_facts.json. Later stages
 * add the levels and the rest of what a tier needs.
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
}

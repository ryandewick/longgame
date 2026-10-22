/**
 * What a quest-progress provider reports about an account: the answer of `GET /api/quest-progress?name=`.
 *
 * The published app has no provider. This is an extension point for a local copy: an add-on (a Nuxt layer in
 * local/) may supply the route, and the app then asks it after every stats refresh. See "Quest progress from a
 * local add-on" in docs/ARCHITECTURE.md.
 */
export interface QuestProgress {
  /** The quests and miniquests the account has completed, named as the app's own data names them. */
  readonly quests: readonly string[]
  /**
   * The quests the account has started and not completed, named the same way. Optional: a provider that cannot
   * tell started from not started leaves it out. The app keeps only the ones whose start matters to something.
   */
  readonly started?: readonly string[]
  /** The diary tiers the account has completed, as a region and a tier: 'Kourend & Kebos Hard'. */
  readonly diaries: readonly string[]
  /** When the provider read this, in milliseconds since 1970. */
  readonly fetched: number
}

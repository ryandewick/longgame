import type { Account } from '../types/account'
import { QUEST_FACTS } from '../data/quest-facts'
import { hasCompletedQuest } from './account'

/**
 * The Kudos an account has within reach (approval 6): what its finished quests gave, 28 for the
 * natural history quiz once it is done, and 50 for cleaning finds once The Dig Site is done. The
 * museum's displays give more, which the app cannot see, so a need above this points to the
 * museum rather than calling the account short.
 */
export function kudosWithinReach(account: Account): number {
  return QUEST_FACTS.reduce(
    (sum, quest) =>
      hasCompletedQuest(account, quest.name)
        ? sum + quest.gives.kudos + quest.gives.kudosOpened
        : sum,
    0,
  )
}

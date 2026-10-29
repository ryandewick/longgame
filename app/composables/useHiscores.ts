import type { AccountType } from '#shared/types/account'
import type { SavedHiscores } from '#shared/domain/save'

/** What /api/account-type answers: which hiscores table the name is on. */
interface AccountTypeLookup {
  type: 'main' | 'ironman'
}

/** What looking a name up gave: its stats, or the sentence to show the player instead. */
export type StatsLookup = { readonly stats: SavedHiscores } | { readonly problem: string }

/**
 * Looking a name up on the hiscores, and keeping what comes back. Every lookup goes through here:
 * the open account's stats fetched again (useStatsRefresh), an account being added, the open
 * account under a new name (useAccounts). `isRefreshing` is shared by them all, so only one runs
 * at a time, every button that starts one can show that it is busy, and no other account can be
 * opened while an answer is on its way for this one.
 */
export function useHiscores(): {
  isRefreshing: Readonly<Ref<boolean>>
  /** Runs a task that looks something up, with `isRefreshing` on meanwhile. While another lookup is under way it runs nothing and resolves null. */
  whileLookingUp: <Outcome>(task: () => Promise<Outcome>) => Promise<Outcome | null>
  lookUpStats: (name: string) => Promise<StatsLookup>
  /** Whether a name is an ironman. Not knowing is fine: an account is planned as a main until it is known. */
  lookUpAccountType: (name: string) => Promise<AccountType | null>
  /**
   * What follows stats arriving for the open account: the quests and diaries a local add-on
   * reports, when there is one, and an XP snapshot. Neither failing stops anything.
   */
  takeIn: (name: string, stats: SavedHiscores) => Promise<void>
  /**
   * Asks a local add-on, when there is one, for the open account's quests and diaries without
   * fetching its stats, as a lookup (`isRefreshing` is on meanwhile). Does nothing without one.
   */
  takeInQuestProgressOnly: () => Promise<void>
} {
  const isRefreshing = useState('stats-refreshing', () => false)
  const account = useAccountStore()
  const history = useHistoryStore()
  const session = useSessionStore()
  const toast = useToast()
  const hasQuestProgressProvider = useQuestProgressProvider()
  // the storage comes from a plugin that only runs in the browser, so it is looked up when a lookup
  // runs (always in the browser) rather than here, which the server reaches too
  const nuxtApp = useNuxtApp()

  async function whileLookingUp<Outcome>(task: () => Promise<Outcome>): Promise<Outcome | null> {
    if (isRefreshing.value) return null
    isRefreshing.value = true
    try {
      return await task()
    } finally {
      isRefreshing.value = false
    }
  }

  async function lookUpStats(name: string): Promise<StatsLookup> {
    try {
      const payload = await $fetch<unknown>('/api/hiscores', { query: { name } })
      const stats = parseHiscores(payload, Date.now())
      return stats
        ? { stats }
        : { problem: 'The hiscores sent something unreadable. Try again in a minute.' }
    } catch (error) {
      return { problem: lookupErrorMessage(error) }
    }
  }

  async function lookUpAccountType(name: string): Promise<AccountType | null> {
    try {
      const { type } = await $fetch<AccountTypeLookup>('/api/account-type', { query: { name } })
      return type === 'main' ? 'main' : 'iron'
    } catch {
      return null
    }
  }

  /**
   * Asks the local add-on what the account has completed and started, and ticks it. A quest or
   * diary step on tonight's session that this settles is ticked off, and the player is told.
   */
  async function takeInQuestProgress(name: string): Promise<void> {
    try {
      const progress = parseQuestProgress(
        await $fetch<unknown>('/api/quest-progress', { query: { name } }),
      )
      if (!progress || account.name !== name) return
      account.recordProgress(progress)
      const message = settledStepsMessage(session.settleSteps())
      if (message) toast.show(message)
    } catch (error) {
      console.warn('Could not read quest progress from the local add-on.', error)
    }
  }

  async function takeInQuestProgressOnly(): Promise<void> {
    const { name } = account
    if (!hasQuestProgressProvider || !name) return
    await whileLookingUp(() => takeInQuestProgress(name))
  }

  async function takeIn(name: string, stats: SavedHiscores): Promise<void> {
    if (hasQuestProgressProvider) await takeInQuestProgress(name)
    try {
      const snapshots = await nuxtApp.$saveStorage.recordSnapshot(
        name,
        xpReading(stats),
        stats.fetchedAt,
      )
      if (account.name === name) history.setSnapshots(snapshots)
    } catch (error) {
      // the stats themselves arrived; a missed snapshot only leaves a gap in the pace figures
      console.warn('Could not record an XP snapshot.', error)
    }
  }

  return {
    isRefreshing: readonly(isRefreshing),
    whileLookingUp,
    lookUpStats,
    lookUpAccountType,
    takeIn,
    takeInQuestProgressOnly,
  }
}

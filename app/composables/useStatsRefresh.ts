/**
 * Stats older than this are fetched again when an account is opened. The hiscores only move when
 * the player logs out, so opening the app, or another account, is the moment to look.
 */
const STATS_GO_STALE_AFTER_MILLISECONDS = 30 * 60_000

/**
 * The open account's stats, fetched again: fresh stats into the account store, an XP snapshot
 * into the history, and a toast saying what changed. In a local copy with a quest-progress add-on,
 * the quests and diaries the add-on reports are ticked as well. The lookup itself, shared with
 * adding and renaming accounts, is useHiscores'.
 */
export function useStatsRefresh(): {
  /** True while any lookup is under way (see useHiscores). */
  isRefreshing: Readonly<Ref<boolean>>
  /**
   * Fetches the open account's stats. Resolves true when they arrived. On failure the reason is
   * shown as a toast and the stats in the store are left as they were.
   */
  refresh: () => Promise<boolean>
  /** Fetches the open account's stats when the ones it has are older than half an hour. */
  refreshIfStale: () => void
} {
  const account = useAccountStore()
  const toast = useToast()
  const { isRefreshing, whileLookingUp, lookUpStats, lookUpAccountType, takeIn } = useHiscores()

  async function refresh(): Promise<boolean> {
    const { name } = account
    if (!name) return false
    const refreshed = await whileLookingUp(async () => {
      const lookup = await lookUpStats(name)
      // another account cannot be opened while a lookup is under way, but a stale answer is
      // never taken in for a different account all the same
      if (account.name !== name) return false
      if ('problem' in lookup) {
        toast.show(lookup.problem)
        return false
      }
      const previous = account.hiscores
      account.applyHiscores(lookup.stats)
      if (!account.accountType) {
        const type = await lookUpAccountType(name)
        if (type && account.name === name) account.setAccountType(type)
      }
      await takeIn(name, lookup.stats)
      if (previous) toast.show(describeStatsUpdate(xpGainedSince(previous, lookup.stats)))
      return true
    })
    return refreshed ?? false
  }

  function refreshIfStale(): void {
    const fetchedAt = account.hiscores?.fetchedAt
    if (fetchedAt !== undefined && Date.now() - fetchedAt > STATS_GO_STALE_AFTER_MILLISECONDS) {
      void refresh()
    }
  }

  return { isRefreshing, refresh, refreshIfStale }
}

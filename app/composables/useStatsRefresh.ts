import type { AccountType } from '#shared/types/account'

/** What /api/account-type answers: which hiscores table the name is on. */
interface AccountTypeLookup {
  type: 'main' | 'ironman'
}

/**
 * Looks the player up on the hiscores and takes the answer in: fresh stats into the account
 * store, an XP snapshot into the history, and a toast saying what changed. In a local copy with a
 * quest-progress add-on, the quests and diaries the add-on reports are ticked as well.
 *
 * `isRefreshing` is shared by everything that can start a lookup, so only one runs at a time and
 * every button that starts one can show that it is busy.
 */
export function useStatsRefresh(): {
  isRefreshing: Readonly<Ref<boolean>>
  refresh: () => Promise<boolean>
  loadAccount: (name: string) => Promise<boolean>
} {
  const isRefreshing = useState('stats-refreshing', () => false)
  const account = useAccountStore()
  const history = useHistoryStore()
  const toast = useToast()
  const hasQuestProgressProvider = useQuestProgressProvider()
  // the storage comes from a plugin that only runs in the browser, so it is looked up when a refresh
  // runs (always in the browser) rather than here, which the server reaches too
  const nuxtApp = useNuxtApp()

  /** Asks whether the name is an ironman. Not knowing is fine: the account is planned as a main until it is known. */
  async function lookUpAccountType(name: string): Promise<AccountType | null> {
    try {
      const { type } = await $fetch<AccountTypeLookup>('/api/account-type', { query: { name } })
      return type === 'main' ? 'main' : 'iron'
    } catch {
      return null
    }
  }

  /**
   * Asks the local add-on which quests and diaries the account has completed, and which quests it
   * has started, and ticks them. Only called when there is such an add-on. Not hearing back is
   * fine: the ticks stay as they were.
   */
  async function takeInQuestProgress(name: string): Promise<void> {
    try {
      const progress = parseQuestProgress(
        await $fetch<unknown>('/api/quest-progress', { query: { name } }),
      )
      if (progress) account.recordProgress(progress)
    } catch (error) {
      console.warn('Could not read quest progress from the local add-on.', error)
    }
  }

  /**
   * Fetches the stats of the account in the store. Resolves true when they arrived. On failure
   * the reason is shown as a toast and the stats in the store are left as they were.
   */
  async function refresh(): Promise<boolean> {
    if (isRefreshing.value || !account.name) return false
    isRefreshing.value = true
    try {
      const { name } = account
      const payload = await $fetch<unknown>('/api/hiscores', { query: { name } })
      const fresh = parseHiscores(payload, Date.now())
      if (!fresh) {
        toast.show('The hiscores sent something unreadable. Try again in a minute.')
        return false
      }
      const previous = account.hiscores
      account.applyHiscores(fresh)

      if (!account.accountType) {
        const type = await lookUpAccountType(name)
        if (type) account.setAccountType(type)
      }
      if (hasQuestProgressProvider) await takeInQuestProgress(name)
      try {
        history.setSnapshots(
          await nuxtApp.$saveStorage.recordSnapshot(name, xpReading(fresh), fresh.fetchedAt),
        )
      } catch (error) {
        // the stats themselves arrived; a missed snapshot only leaves a gap in the pace figures
        console.warn('Could not record an XP snapshot.', error)
      }

      if (previous) toast.show(describeStatsUpdate(xpGainedSince(previous, fresh)))
      return true
    } catch (error) {
      toast.show(lookupErrorMessage(error))
      return false
    } finally {
      isRefreshing.value = false
    }
  }

  /**
   * Starts planning for a name: what the setup screen's button does. A different name from the
   * one in the store starts a new account. Resolves true when its stats arrived.
   */
  async function loadAccount(name: string): Promise<boolean> {
    if (!name.trim()) {
      toast.show('Type your name first.')
      return false
    }
    account.setName(name)
    return refresh()
  }

  return { isRefreshing: readonly(isRefreshing), refresh, loadAccount }
}

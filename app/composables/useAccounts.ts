import type { XpSnapshot } from '#shared/types/snapshot'
import { isSameName } from '#shared/domain/player-names'
import { newAccountSave } from '#shared/domain/save'

/** How adding an account went. */
export type AddOutcome =
  /** The account was looked up, added and opened. */
  | { readonly kind: 'added' }
  /** An account by that name was already saved, so it was opened instead. */
  | { readonly kind: 'opened' }
  /** Nothing was added, for this reason, which the player should be shown. */
  | { readonly kind: 'refused'; readonly problem: string }

/** What to tell the player when a lookup is asked for while another is under way. */
const LOOKUP_UNDER_WAY = 'Another lookup is under way. Try again in a moment.'

/**
 * The accounts the player keeps (stores/account-list.ts), from the screens' side: opening one,
 * adding one, renaming the open one, forgetting it and importing one. These are the steps the
 * store cannot take itself: a name is looked up on the hiscores before it is added or taken on,
 * an account's XP history is read from storage to arrive with it, a name change carries the
 * history over, and the save is written straight away.
 *
 * Every one of them leaves the player on the page they are on. When the planner is drawn for a
 * different account, what the visit remembered about the last one goes (the question run) and the
 * rack, if the page has it, fills from empty for the new one: the Load moment. A page without the
 * rack moves nothing, and the next page with it does not fill. A name change is the same account,
 * so nothing fills.
 */
export function useAccounts(): {
  /** True while any lookup is under way (see useHiscores). Another account cannot be opened meanwhile. */
  isRefreshing: Readonly<Ref<boolean>>
  /** Opens a saved account. */
  open: (name: string) => Promise<void>
  /** Looks a name up and, when it is on the hiscores, adds it as a new account and opens it. */
  add: (name: string) => Promise<AddOutcome>
  /**
   * The open account goes by a new name. The name is looked up first, and nothing changes unless
   * it is on the hiscores and no other saved account has it. Resolves true when it changed.
   */
  rename: (name: string) => Promise<boolean>
  /**
   * The setup screen's button: adds the first account or, when the open account has never had its
   * stats (a name an older version kept, which never loaded), takes the name on for it, ticks and
   * all. Resolves true when the stats arrived.
   */
  loadAccount: (name: string) => Promise<boolean>
  /** Forgets the open account and opens the next one; with none left, the setup screen shows on Tonight's address. */
  forgetOpen: () => Promise<void>
  /**
   * Adds an exported account, or puts it in the place of the saved account with the same name,
   * and opens it. Its XP history is merged with any already kept for that name.
   */
  importAccount: (backup: AccountBackup) => Promise<void>
} {
  const list = useAccountListStore()
  const account = useAccountStore()
  const toast = useToast()
  const questionRun = useQuestionRun()
  const { isRefreshing, whileLookingUp, lookUpStats, lookUpAccountType, takeIn } = useHiscores()
  const { refreshIfStale } = useStatsRefresh()
  // the storage and the save's writer come from a plugin that only runs in the browser, so they are
  // looked up when an action runs (always in the browser) rather than here
  const nuxtApp = useNuxtApp()

  /** A name's XP history, or none when storage cannot be read: an account opens all the same. */
  async function historyOf(name: string): Promise<XpSnapshot[]> {
    try {
      return await nuxtApp.$saveStorage.readSnapshots(name)
    } catch (error) {
      console.warn('Could not read the XP history.', error)
      return []
    }
  }

  /**
   * The planner is now drawn for a different account. Call it in the same tick as the change, so
   * the Load moment is announced with it (see useMotion); the save is then written at once, and
   * stats more than half an hour old are fetched.
   */
  async function drawnForAnother(): Promise<void> {
    questionRun.reset()
    expectFirstLoad()
    announceMoment({ name: 'first-load' })
    await nuxtApp.$flushSave()
    refreshIfStale()
  }

  async function open(name: string): Promise<void> {
    // a lookup under way is for the account open now: its answer comes first
    if (isRefreshing.value || !list.has(name)) return
    const snapshots = await historyOf(name)
    if (list.open(name, snapshots)) await drawnForAnother()
  }

  /**
   * Looks a name up and adds it as a new account, opened. The setup screen's first account is a
   * first load like any other, whose rack PlannerPage fills when it sees the account arrive, so
   * nothing more is announced for it here.
   */
  async function lookUpAndAdd(name: string, fromSetupScreen: boolean): Promise<AddOutcome> {
    const outcome = await whileLookingUp(async (): Promise<AddOutcome> => {
      const lookup = await lookUpStats(name)
      if ('problem' in lookup) return { kind: 'refused', problem: lookup.problem }
      const accountType = await lookUpAccountType(name)
      // a name added before picks its history up again
      const snapshots = await historyOf(name)
      if (!list.add(newAccountSave(name, lookup.stats, accountType), snapshots)) {
        return { kind: 'refused', problem: `${name} is saved already.` }
      }
      if (fromSetupScreen) await nuxtApp.$flushSave()
      else await drawnForAnother()
      await takeIn(name, lookup.stats)
      return { kind: 'added' }
    })
    return outcome ?? { kind: 'refused', problem: LOOKUP_UNDER_WAY }
  }

  async function add(typed: string): Promise<AddOutcome> {
    const name = typed.trim()
    if (!name) return { kind: 'refused', problem: 'Type a name first.' }
    const already = list.savedName(name)
    if (already === null) return lookUpAndAdd(name, false)
    await open(already)
    toast.show(`${already} is saved already, so it is open now.`)
    return { kind: 'opened' }
  }

  /**
   * Looks the new name up and takes it on for the open account: its history follows it, and its
   * type is looked up if it was never known. Returns the problem to show when it could not.
   */
  async function takeName(name: string): Promise<string | null> {
    const oldName = account.name
    const outcome = await whileLookingUp(async (): Promise<{ problem: string | null }> => {
      const lookup = await lookUpStats(name)
      if ('problem' in lookup) return { problem: lookup.problem }
      try {
        await nuxtApp.$saveStorage.mergeSnapshots(name, await historyOf(oldName))
      } catch (error) {
        console.warn('Could not carry the XP history over to the new name.', error)
      }
      account.rename(name, lookup.stats)
      if (!account.accountType) {
        const type = await lookUpAccountType(name)
        if (type) account.setAccountType(type)
      }
      await takeIn(name, lookup.stats)
      await nuxtApp.$flushSave()
      return { problem: null }
    })
    return outcome ? outcome.problem : LOOKUP_UNDER_WAY
  }

  async function rename(typed: string): Promise<boolean> {
    const name = typed.trim()
    if (!name) {
      toast.show('Type the new name first.')
      return false
    }
    if (name === account.name) return false
    const other = list.accounts.find(
      (save, place) => place !== list.openIndex && isSameName(save.name, name),
    )
    if (other) {
      toast.show(`You have ${other.name} saved already. Open it from the menu under your name.`)
      return false
    }
    const problem = await takeName(name)
    if (problem) {
      toast.show(problem)
      return false
    }
    toast.show(`This account goes by ${name} now. Everything else is as it was.`)
    return true
  }

  async function loadAccount(typed: string): Promise<boolean> {
    const name = typed.trim()
    if (!name) {
      toast.show('Type your name first.')
      return false
    }
    if (list.openIndex === null) {
      const outcome = await lookUpAndAdd(name, true)
      if (outcome.kind === 'refused') toast.show(outcome.problem)
      return outcome.kind !== 'refused'
    }
    // PlannerPage sees the account's stats arrive and fills the rack, as for any first load
    const problem = await takeName(name)
    if (problem) toast.show(problem)
    return problem === null
  }

  async function forgetOpen(): Promise<void> {
    const next = list.nextAfterForgetting
    const snapshots = next === null ? [] : await historyOf(next)
    list.forgetOpen(snapshots)
    if (next !== null) {
      await drawnForAnother()
      return
    }
    // no account is left: a first visit again, from the home page
    questionRun.reset()
    await nuxtApp.$flushSave()
    await navigateTo('/')
  }

  async function importAccount({ save, snapshots }: AccountBackup): Promise<void> {
    let history: XpSnapshot[] = snapshots
    try {
      history = await nuxtApp.$saveStorage.mergeSnapshots(save.name, snapshots)
    } catch (error) {
      // the account still comes in, with the file's history for this visit
      console.warn('Could not keep the imported XP history.', error)
    }
    if (!list.replace(save, history)) list.add(save, history)
    await drawnForAnother()
  }

  return { isRefreshing, open, add, rename, loadAccount, forgetOpen, importAccount }
}

import type { XpSnapshot } from '#shared/types/snapshot'
import { openAccountSave, type SavedAccounts } from '#shared/domain/save'

/** A change is written this long after the last one, so a burst of changes is one write. */
const SAVE_DELAY_MILLISECONDS = 400

/** The browser's storage, or one that lasts for the visit when the browser refuses (private modes, blocked cookies). */
function browserStorage(): KeyValueStorage {
  try {
    return window.localStorage
  } catch {
    return createMemoryStorage()
  }
}

/** The browser's word that another tab of this site changed its storage. */
const otherTabChanges: OtherTabChanges = (listener) => {
  const hear = (event: StorageEvent): void => listener(event.key, event.newValue)
  window.addEventListener('storage', hear)
  return () => window.removeEventListener('storage', hear)
}

/**
 * Keeps the stores and the save in step.
 *
 * On start: once the page has hydrated, the saved accounts are read into the stores (the open
 * one with its XP history) and `useSaveReady()` turns true. Reading waits for hydration because
 * the server rendered the page without any account, and the first render in the browser has to
 * match it.
 *
 * Afterwards: any change to the accounts is written back, a moment later. On the website, when
 * another tab saves, this tab takes that save in rather than keeping its own, so the two never
 * write over each other: a change this tab had waiting is older than theirs and goes.
 *
 * Provides `$saveStorage` (where the saves and the XP snapshots live in this mode) and
 * `$flushSave` (write the accounts as they are now, at once).
 */
export default defineNuxtPlugin((nuxtApp) => {
  const storage =
    useAppMode() === 'local'
      ? createServerSaveStorage((path, options) => $fetch<unknown>(path, options))
      : createBrowserSaveStorage(browserStorage(), otherTabChanges)
  const ready = useSaveReady()
  const list = useAccountListStore()
  const questionRun = useQuestionRun()

  /** The saved accounts as they were last written or read, so the same ones are not written again. */
  let written: SavedAccounts | null = null
  let saveTimer: number | undefined

  async function flushSave(): Promise<void> {
    window.clearTimeout(saveTimer)
    // until the save has loaded, the stores hold nothing of the player's to write
    if (!ready.value) return
    const saved = list.savedAccounts
    if (saved === written) return
    written = saved
    try {
      await storage.writeAccounts(saved)
    } catch (error) {
      // storage is full or the local server is not answering: the stores still hold everything,
      // and the next change tries again
      console.warn('Could not save.', error)
    }
  }

  function saveSoon(): void {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => void flushSave(), SAVE_DELAY_MILLISECONDS)
  }

  /** The open account's XP history, or none when it cannot be read: the save loads all the same. */
  async function openHistory(saved: SavedAccounts): Promise<XpSnapshot[]> {
    const open = openAccountSave(saved)
    if (!open?.name) return []
    try {
      return await storage.readSnapshots(open.name)
    } catch (error) {
      console.warn('Could not read the XP history.', error)
      return []
    }
  }

  /** Another tab saved: this one takes that save in, and fills the rack if it opened another account. */
  async function takeInOtherTab(saved: SavedAccounts): Promise<void> {
    window.clearTimeout(saveTimer)
    const openBefore = list.savedAccounts.open
    const snapshots = await openHistory(saved)
    list.restore(saved, snapshots)
    written = list.savedAccounts
    if (saved.open === openBefore) return
    questionRun.reset()
    expectFirstLoad()
    announceMoment({ name: 'first-load' })
  }

  async function load(): Promise<void> {
    try {
      const saved = await storage.readAccounts()
      if (saved) list.restore(saved, await openHistory(saved))
    } catch (error) {
      console.error('Could not read the save, so starting without one.', error)
    }
    // loading the save is not itself written back: the first change is
    written = list.savedAccounts
    watch(() => list.savedAccounts, saveSoon)
    storage.watchOtherTabs((saved) => void takeInOtherTab(saved))
    ready.value = true
  }

  nuxtApp.hooks.hookOnce('app:suspense:resolve', load)

  // a tab being hidden may never come back: do not leave the last change waiting on a timer
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSave()
  })

  return { provide: { saveStorage: storage, flushSave } }
})

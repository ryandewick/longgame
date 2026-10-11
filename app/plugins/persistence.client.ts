import type { SavedState } from '#shared/domain/save'

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

/**
 * Keeps the stores and the save in step.
 *
 * On start: once the page has hydrated, the save is read into the stores and `useSaveReady()`
 * turns true. Reading waits for hydration because the server rendered the page without any
 * account, and the first render in the browser has to match it.
 *
 * Afterwards: any change to the stores is written back, a moment later.
 *
 * Provides `$saveStorage` (where the save and the XP snapshots live in this mode) and
 * `$flushSave` (write any pending change now).
 */
export default defineNuxtPlugin((nuxtApp) => {
  const storage =
    useAppMode() === 'local'
      ? createServerSaveStorage((path, options) => $fetch<unknown>(path, options))
      : createBrowserSaveStorage(browserStorage())
  const ready = useSaveReady()
  const { savedState, restore } = useSavedState()
  const history = useHistoryStore()

  let unsaved: SavedState | null = null
  let saveTimer: number | undefined

  async function flushSave(): Promise<void> {
    window.clearTimeout(saveTimer)
    if (!unsaved) return
    const save = unsaved
    unsaved = null
    try {
      await storage.writeSave(save)
    } catch (error) {
      // storage is full or the local server is not answering: the stores still hold everything,
      // and the next change tries again
      console.warn('Could not save.', error)
    }
  }

  function saveSoon(save: SavedState): void {
    unsaved = save
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(flushSave, SAVE_DELAY_MILLISECONDS)
  }

  async function load(): Promise<void> {
    try {
      const save = await storage.readSave()
      if (save) {
        restore(save)
        if (save.name) history.setSnapshots(await storage.readSnapshots(save.name))
      }
    } catch (error) {
      console.error('Could not read the save, so starting without one.', error)
    }
    // watching starts only now, so loading the save is not itself written back
    watch(savedState, saveSoon)
    ready.value = true
  }

  nuxtApp.hooks.hookOnce('app:suspense:resolve', load)

  // a tab being hidden may never come back: do not leave the last change waiting on a timer
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSave()
  })

  return { provide: { saveStorage: storage, flushSave } }
})

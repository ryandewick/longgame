import { computed, type ComputedRef } from 'vue'
import { SAVE_VERSION, type SavedState } from '#shared/domain/save'
import { useAccountStore } from '../stores/account'
import { useHistoryStore } from '../stores/history'
import { useSessionStore } from '../stores/session'

/**
 * The three stores as one save, and back. `savedState` is everything that is kept between
 * visits, in the versioned format of shared/domain/save.ts; `restore` puts a save into the
 * stores. XP snapshots are not part of the save: they are stored by player name (see
 * utils/save-storage.ts) and loaded into the history store separately.
 */
export function useSavedState(): {
  savedState: ComputedRef<SavedState>
  restore: (save: SavedState) => void
} {
  const account = useAccountStore()
  const session = useSessionStore()
  const history = useHistoryStore()

  const savedState = computed<SavedState>(() => ({
    version: SAVE_VERSION,
    ...account.saved,
    ...session.saved,
    ...history.saved,
  }))

  function restore(save: SavedState): void {
    account.restore(save)
    session.restore(save)
    history.restore(save)
  }

  return { savedState, restore }
}

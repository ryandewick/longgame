import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type { XpSnapshot } from '#shared/types/snapshot'
import { isSameName } from '#shared/domain/player-names'
import {
  blankSave,
  SAVED_ACCOUNTS_VERSION,
  type SavedAccounts,
  type SavedState,
} from '#shared/domain/save'
import { useSavedState } from '../composables/useSavedState'
import { useHistoryStore } from './history'

/**
 * The accounts the player keeps, and which one is open.
 *
 * The open account lives in the account, session and history stores, which is where everything on
 * screen reads it from, and `useSavedState` joins them into its save. This store holds every
 * account's save in the order they were added, and where the open one sits. The open one's entry
 * here is as it was when it was opened: the whole (`accounts`, `savedAccounts`) is built with the
 * live save in its place, and opening another account first puts the live save back here, so an
 * account is always left exactly as it was.
 *
 * XP snapshots are kept by player name in storage, not in a save: the actions that open an
 * account are handed its history, read beforehand, so it arrives together with the account.
 */
export const useAccountListStore = defineStore('account-list', () => {
  const { savedState: openSave, restore: restoreOpen } = useSavedState()
  const history = useHistoryStore()

  /** Every account's save, in the order they were added. */
  const saves = shallowRef<readonly SavedState[]>([])
  /** Where the open account is in the list; null when none is open. */
  const openIndex = shallowRef<number | null>(null)

  /** Every account as it is now, in order, the open one as the stores hold it. */
  const accounts = computed<readonly SavedState[]>(() => {
    const open = openIndex.value
    if (open === null) return saves.value
    return saves.value.map((save, place) => (place === open ? openSave.value : save))
  })

  /** Everything that is kept, in the saved format. */
  const savedAccounts = computed<SavedAccounts>(() => ({
    version: SAVED_ACCOUNTS_VERSION,
    open: openIndex.value === null ? null : openSave.value.name,
    accounts: accounts.value,
  }))

  /**
   * The account that opens when the open one is forgotten: the one after it, or the one before it
   * when it is the last. Null when it is the only one, or none is open.
   */
  const nextAfterForgetting = computed<string | null>(() => {
    const open = openIndex.value
    if (open === null) return null
    return (accounts.value[open + 1] ?? accounts.value[open - 1])?.name ?? null
  })

  /** Where the account with this name is in the list, case and spacing aside; -1 when none is. */
  function placeOf(name: string): number {
    return accounts.value.findIndex((save) => isSameName(save.name, name))
  }

  /** Is an account by this name saved? Two accounts never share a name. */
  function has(name: string): boolean {
    return placeOf(name) >= 0
  }

  /** The saved account's name as its save spells it, for a name typed any way; null when none has it. */
  function savedName(name: string): string | null {
    return accounts.value[placeOf(name)]?.name ?? null
  }

  /** Puts a save and its XP history into the account, session and history stores. */
  function load(save: SavedState, snapshots: readonly XpSnapshot[]): void {
    restoreOpen(save)
    history.setSnapshots(snapshots)
  }

  /** Puts the open account back in its place in the list, exactly as the stores hold it now. */
  function putAway(): void {
    saves.value = accounts.value
  }

  /**
   * Takes in the saved accounts as storage holds them, with the open account's XP history: the
   * open one goes into the stores and the rest are kept here. With no account open the stores are
   * blank, as on a first visit.
   */
  function restore(saved: SavedAccounts, snapshots: readonly XpSnapshot[]): void {
    const named = saved.accounts.findIndex((save) => save.name === saved.open)
    const open = named >= 0 ? named : 0
    const save = saved.accounts[open]
    saves.value = saved.accounts
    openIndex.value = save ? open : null
    load(save ?? blankSave(), save ? snapshots : [])
  }

  /**
   * Opens a saved account, with its XP history. The account open until now is put away first,
   * exactly as it is. Returns false when no account has that name, or it is the one open.
   */
  function open(name: string, snapshots: readonly XpSnapshot[]): boolean {
    const place = placeOf(name)
    const save = accounts.value[place]
    if (!save || place === openIndex.value) return false
    putAway()
    openIndex.value = place
    load(save, snapshots)
    return true
  }

  /**
   * Adds an account at the end of the list and opens it, with its XP history (a name added before
   * picks up the history it left). The account open until now is put away first. Returns false,
   * and changes nothing, when an account by that name is already saved.
   */
  function add(save: SavedState, snapshots: readonly XpSnapshot[]): boolean {
    if (has(save.name)) return false
    putAway()
    saves.value = [...saves.value, save]
    openIndex.value = saves.value.length - 1
    load(save, snapshots)
    return true
  }

  /**
   * Puts this save in the place of the saved account with the same name (an import of a backup)
   * and opens it, with its XP history. Another account that was open is put away first. Returns
   * false, and changes nothing, when no account has that name.
   */
  function replace(save: SavedState, snapshots: readonly XpSnapshot[]): boolean {
    const place = placeOf(save.name)
    if (place < 0) return false
    if (place !== openIndex.value) putAway()
    saves.value = saves.value.map((kept, index) => (index === place ? save : kept))
    openIndex.value = place
    load(save, snapshots)
    return true
  }

  /**
   * Forgets the open account. The one after it opens, or the one before it when it was the last
   * (`nextAfterForgetting`), with the XP history given for it. With no account left the stores go
   * blank, as on a first visit. The forgotten account's XP history is not part of its save, so it
   * stays in storage under its name.
   */
  function forgetOpen(snapshotsOfNext: readonly XpSnapshot[]): void {
    const open = openIndex.value
    if (open === null) return
    const remaining = saves.value.filter((_save, place) => place !== open)
    const next = Math.min(open, remaining.length - 1)
    const save = remaining[next]
    saves.value = remaining
    openIndex.value = save ? next : null
    load(save ?? blankSave(), save ? snapshotsOfNext : [])
  }

  return {
    saves,
    openIndex,
    accounts,
    savedAccounts,
    nextAfterForgetting,
    has,
    savedName,
    restore,
    open,
    add,
    replace,
    forgetOpen,
  }
})

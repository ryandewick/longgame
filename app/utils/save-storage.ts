import type { XpSnapshot } from '#shared/types/snapshot'
import { nameKey } from '#shared/domain/player-names'
import {
  migrateLegacySnapshots,
  readSave,
  readSavedAccounts,
  savedAccountsFrom,
  type LegacySnapshot,
  type SavedAccounts,
} from '#shared/domain/save'
import {
  appendSnapshot,
  mergeSnapshots as mergeHistories,
  parseSnapshots,
} from '#shared/domain/snapshots'
import type { XpReading } from './hiscores'

/*
 * Where the save lives. The website keeps it in the browser; a local copy keeps it on disk
 * through its own server. The rest of the app talks to this one interface and does not know which.
 */

export interface SaveStorage {
  /**
   * Every saved account, brought up to the current format: the saved accounts, or, while there
   * are none yet, the single save an earlier version kept, as the first account. Null when
   * nothing has been saved at all.
   */
  readAccounts(): Promise<SavedAccounts | null>
  writeAccounts(saved: SavedAccounts): Promise<void>
  /** A player's XP history, oldest first. */
  readSnapshots(name: string): Promise<XpSnapshot[]>
  /** Adds a reading taken at `now` to a player's XP history and returns the whole history. */
  recordSnapshot(name: string, reading: XpReading, now: number): Promise<XpSnapshot[]>
  /**
   * Merges a history into a player's (`mergeSnapshots` in shared/domain/snapshots.ts) and returns
   * what is now kept. This is how a history follows an account to a new name and how an imported
   * one joins the one already kept. Nothing already kept is ever lost.
   */
  mergeSnapshots(name: string, snapshots: readonly XpSnapshot[]): Promise<XpSnapshot[]>
  /**
   * Calls `listener` with the saved accounts each time another tab of the site saves them. Only
   * the browser can tell; a local copy is one tab and never calls. Returns what stops it.
   */
  watchOtherTabs(listener: (saved: SavedAccounts) => void): () => void
}

/** The most snapshots the browser keeps for one player: about two years of daily play. */
export const BROWSER_SNAPSHOT_LIMIT = 600

// Where the website keeps every saved account. The first-paint script (utils/returning-player.ts)
// reads the same keys; tests/app/returning-player.test.ts checks that the two files agree.
const ACCOUNTS_KEY = 'longgame.accounts'
const SNAPSHOTS_KEY_PREFIX = 'longgame.snapshots.'

// Where earlier versions kept a single account's save: this app before it kept several, then
// the vanilla app. Read only while there are no saved accounts, and never written or removed:
// an old save is migrated, not thrown away, so it stays behind as a backup.
const SINGLE_SAVE_KEY = 'longgame.save'
const LEGACY_SAVE_KEY = 'longgame.state.v1'
const LEGACY_SNAPSHOTS_KEY_PREFIX = 'longgame.snaps.'

/** The part of the Web Storage API this needs, so a test can hand in a plain object. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * How the browser says another tab changed its storage (the `storage` event): `listener` hears the
 * key and its new value. Returns what stops listening. A test hands in its own.
 */
export type OtherTabChanges = (
  listener: (key: string | null, value: string | null) => void,
) => () => void

function parseJson(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    // a value cut short or edited by hand is treated as not there
    return null
  }
}

const readJson = (storage: KeyValueStorage, key: string): unknown => parseJson(storage.getItem(key))

/** Is this parsed JSON an XP snapshot as the vanilla app kept them? */
export const isLegacySnapshot = (value: unknown): value is LegacySnapshot =>
  typeof value === 'object' &&
  value !== null &&
  't' in value &&
  typeof value.t === 'number' &&
  'skills' in value &&
  typeof value.skills === 'object' &&
  value.skills !== null

/** The website's storage: the browser's own, which only this browser can read. */
export function createBrowserSaveStorage(
  storage: KeyValueStorage,
  otherTabChanges?: OtherTabChanges,
): SaveStorage {
  /**
   * The saved accounts' text as this tab last wrote or heard it. The same text is not written
   * again, so a tab that has just taken in another tab's save does not send it straight back.
   */
  let lastText: string | null = null

  function storedSnapshots(name: string): XpSnapshot[] {
    const current = readJson(storage, SNAPSHOTS_KEY_PREFIX + nameKey(name))
    if (current !== null) return parseSnapshots(current)
    const legacy = readJson(storage, LEGACY_SNAPSHOTS_KEY_PREFIX + nameKey(name))
    return Array.isArray(legacy) ? migrateLegacySnapshots(legacy.filter(isLegacySnapshot)) : []
  }

  function keepSnapshots(name: string, snapshots: readonly XpSnapshot[]): void {
    storage.setItem(SNAPSHOTS_KEY_PREFIX + nameKey(name), JSON.stringify(snapshots))
  }

  return {
    async readAccounts() {
      const saved = readSavedAccounts(readJson(storage, ACCOUNTS_KEY))
      if (saved) return saved
      const single =
        readSave(readJson(storage, SINGLE_SAVE_KEY)) ?? readSave(readJson(storage, LEGACY_SAVE_KEY))
      return single && savedAccountsFrom(single)
    },

    async writeAccounts(saved) {
      const text = JSON.stringify(saved)
      if (text === lastText) return
      storage.setItem(ACCOUNTS_KEY, text)
      lastText = text
    },

    async readSnapshots(name) {
      return storedSnapshots(name)
    },

    async recordSnapshot(name, reading, now) {
      const { snapshots } = appendSnapshot(
        storedSnapshots(name),
        { takenAt: now, skills: reading.skills, totalXp: reading.totalXp },
        BROWSER_SNAPSHOT_LIMIT,
      )
      keepSnapshots(name, snapshots)
      return snapshots
    },

    async mergeSnapshots(name, snapshots) {
      const merged = mergeHistories(storedSnapshots(name), snapshots, BROWSER_SNAPSHOT_LIMIT)
      keepSnapshots(name, merged)
      return merged
    },

    watchOtherTabs(listener) {
      if (!otherTabChanges) return () => undefined
      return otherTabChanges((key, value) => {
        // a removed key (site data cleared in the other tab) leaves this tab as it is
        if (key !== ACCOUNTS_KEY || value === null) return
        lastText = value
        const saved = readSavedAccounts(parseJson(value))
        if (saved) listener(saved)
      })
    },
  }
}

/** Storage that lasts as long as the page: what the website falls back to when the browser refuses it storage. */
export function createMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

/** A request to this app's own API. `$fetch` fits; a test can hand in a stub. */
export type ApiRequest = (
  path: string,
  options?: { method?: 'GET' | 'PUT' | 'POST'; query?: Record<string, string>; body?: object },
) => Promise<unknown>

/**
 * A local copy's storage: files on the player's own disk, behind /api/accounts and
 * /api/snapshots. /api/state is the single save of earlier versions, only ever read.
 */
export function createServerSaveStorage(request: ApiRequest): SaveStorage {
  async function readSnapshots(name: string): Promise<XpSnapshot[]> {
    return parseSnapshots(await request('/api/snapshots', { query: { name } }))
  }

  return {
    async readAccounts() {
      // each route answers `{}` when it has nothing, which reads as no save
      const saved = readSavedAccounts(await request('/api/accounts'))
      if (saved) return saved
      const single = readSave(await request('/api/state'))
      return single && savedAccountsFrom(single)
    },

    async writeAccounts(saved) {
      await request('/api/accounts', { method: 'PUT', body: saved })
    },

    readSnapshots,

    // the server stamps the time and applies the append rule itself, so only the reading is sent
    async recordSnapshot(name, reading) {
      await request('/api/snapshots', {
        method: 'POST',
        body: { name, skills: reading.skills, totalXp: reading.totalXp },
      })
      return readSnapshots(name)
    },

    // the server merges by the same rule, so a history is never replaced from the browser
    async mergeSnapshots(name, snapshots) {
      await request('/api/snapshots/merge', { method: 'POST', body: { name, snapshots } })
      return readSnapshots(name)
    },

    watchOtherTabs() {
      return () => undefined
    },
  }
}

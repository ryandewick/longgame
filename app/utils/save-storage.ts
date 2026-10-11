import type { XpSnapshot } from '#shared/types/snapshot'
import {
  migrateLegacySnapshots,
  readSave,
  type LegacySnapshot,
  type SavedState,
} from '#shared/domain/save'
import { appendSnapshot, parseSnapshots } from '#shared/domain/snapshots'
import type { XpReading } from './hiscores'

/*
 * Where the save lives. The website keeps it in the browser; a local copy keeps it on disk
 * through its own server. The rest of the app talks to this one interface and does not know which.
 */

export interface SaveStorage {
  /** The save, brought up to the current format. Null when nothing has been saved yet. */
  readSave(): Promise<SavedState | null>
  writeSave(save: SavedState): Promise<void>
  /** A player's XP history, oldest first. */
  readSnapshots(name: string): Promise<XpSnapshot[]>
  /** Adds a reading taken at `now` to a player's XP history and returns the whole history. */
  recordSnapshot(name: string, reading: XpReading, now: number): Promise<XpSnapshot[]>
  /**
   * Replaces a player's XP history with the one given, oldest first, and returns what is now
   * kept. This is for importing a file, which only the website offers: a local copy's history
   * is carried over by copying its data folder, so its storage refuses.
   */
  replaceSnapshots(name: string, snapshots: readonly XpSnapshot[]): Promise<XpSnapshot[]>
}

/** The most snapshots the browser keeps for one player: about two years of daily play. */
export const BROWSER_SNAPSHOT_LIMIT = 600

const SAVE_KEY = 'longgame.save'
const SNAPSHOTS_KEY_PREFIX = 'longgame.snapshots.'

// Where the vanilla app kept the same things. They are read once, when this app has nothing of
// its own, and never written or removed: an old save is migrated, not thrown away.
const LEGACY_SAVE_KEY = 'longgame.state.v1'
const LEGACY_SNAPSHOTS_KEY_PREFIX = 'longgame.snaps.'

/** The part of the Web Storage API this needs, so a test can hand in a plain object. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Names are not case sensitive and the game treats a space and an underscore alike. */
const nameKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '_')

function readJson(storage: KeyValueStorage, key: string): unknown {
  const raw = storage.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    // a value cut short or edited by hand is treated as not there
    return null
  }
}

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
export function createBrowserSaveStorage(storage: KeyValueStorage): SaveStorage {
  function storedSnapshots(name: string): XpSnapshot[] {
    const current = readJson(storage, SNAPSHOTS_KEY_PREFIX + nameKey(name))
    if (current !== null) return parseSnapshots(current)
    const legacy = readJson(storage, LEGACY_SNAPSHOTS_KEY_PREFIX + nameKey(name))
    return Array.isArray(legacy) ? migrateLegacySnapshots(legacy.filter(isLegacySnapshot)) : []
  }

  return {
    async readSave() {
      return readSave(readJson(storage, SAVE_KEY)) ?? readSave(readJson(storage, LEGACY_SAVE_KEY))
    },

    async writeSave(save) {
      storage.setItem(SAVE_KEY, JSON.stringify(save))
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
      storage.setItem(SNAPSHOTS_KEY_PREFIX + nameKey(name), JSON.stringify(snapshots))
      return snapshots
    },

    async replaceSnapshots(name, snapshots) {
      const kept = snapshots.slice(-BROWSER_SNAPSHOT_LIMIT)
      storage.setItem(SNAPSHOTS_KEY_PREFIX + nameKey(name), JSON.stringify(kept))
      return kept
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

/** A local copy's storage: files on the player's own disk, behind /api/state and /api/snapshots. */
export function createServerSaveStorage(request: ApiRequest): SaveStorage {
  async function readSnapshots(name: string): Promise<XpSnapshot[]> {
    return parseSnapshots(await request('/api/snapshots', { query: { name } }))
  }

  return {
    async readSave() {
      // the route answers `{}` when nothing has been saved, which `readSave` reads as no save
      return readSave(await request('/api/state'))
    },

    async writeSave(save) {
      await request('/api/state', { method: 'PUT', body: save })
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

    async replaceSnapshots() {
      throw new Error('A local copy keeps its XP history on disk and does not import one.')
    },
  }
}

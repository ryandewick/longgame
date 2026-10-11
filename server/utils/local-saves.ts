/**
 * Where local mode keeps a player's saves: Nitro's `data` storage mount.
 *
 * Nitro backs `data` with the file system by itself, in `nuxt dev` (the fs driver at <project>/.data/kv) and in any
 * Node build (the fs-lite driver at ./.data/kv, relative to the folder the server is started from, which the
 * launcher makes the top of the project). On Cloudflare there is no such mount, which is right: these functions are
 * only reached in local mode. Leaving the mount to Nitro rather than declaring a driver for every build keeps Node's
 * file system code out of the Workers build.
 *
 * Files:  .data/kv/state.json              the saved state
 *         .data/kv/snapshots/<name>.json   one XP history per player
 *
 * Carrying an old save over. The app this one replaced kept the same two things in data/ at the top of the project:
 * data/state.json and data/snapshots_<name>.json. A local build mounts that folder read-only as `legacy-saves`
 * (nuxt.config.ts). While this app has nothing of its own for a save or for a player's history, the old file is
 * served in its place: the state as it is, because the app knows how to bring an old save up to date (`readSave` in
 * shared/domain/save.ts), and the history in this app's shape. The first write then lands in .data/kv, and from
 * then on that is what is read. The old files are never written to or removed, so they stay behind as a backup.
 */
import { isJsonRecord, type JsonRecord } from './json'
import {
  legacySnapshotStorageKey,
  parseLegacySnapshots,
  parseStoredSnapshots,
  snapshotStorageKey,
  type Snapshot,
} from './snapshots'

const STATE_KEY = 'state.json'
const LEGACY_STATE_KEY = 'state.json'

function saves() {
  return useStorage('data')
}

/** The old app's data folder, read-only. Empty for a player who never ran the old app. */
function legacySaves() {
  return useStorage('legacy-saves')
}

/** Storage answers null for a file that is not there. */
function isMissing(stored: unknown): boolean {
  return stored === null || stored === undefined
}

/** The saved state, or an empty object when nothing has been saved yet. */
export async function readSavedState(): Promise<JsonRecord> {
  const stored: unknown = await saves().getItem(STATE_KEY)
  if (isJsonRecord(stored)) return stored
  const legacy: unknown = await legacySaves().getItem(LEGACY_STATE_KEY)
  return isJsonRecord(legacy) ? legacy : {}
}

/** Replaces the saved state. Its contents belong to the app, which versions them; the server only keeps them. */
export async function writeSavedState(state: JsonRecord): Promise<void> {
  await saves().setItem(STATE_KEY, state)
}

/** A player's XP history, oldest first. Empty when there is none. */
export async function readSnapshots(name: string): Promise<Snapshot[]> {
  const stored: unknown = await saves().getItem(snapshotStorageKey(name))
  // a history of this app's own is used even when it is empty: only a missing file falls back to the old app's
  if (!isMissing(stored)) return parseStoredSnapshots(stored)
  return parseLegacySnapshots(await legacySaves().getItem(legacySnapshotStorageKey(name)))
}

/** Replaces a player's XP history. */
export async function writeSnapshots(name: string, snapshots: Snapshot[]): Promise<void> {
  await saves().setItem(snapshotStorageKey(name), snapshots)
}

import type { XpSnapshot } from '#shared/types/snapshot'
import { blankSave, migrateLegacySnapshots, readSave, type SavedState } from '#shared/domain/save'
import { parseSnapshots } from '#shared/domain/snapshots'
import { isLegacySnapshot } from './save-storage'

/*
 * The file "Export my data" writes and "Import a file" reads: one account's save and its XP
 * history. Two shapes are read:
 *
 *   this app's         { longgame: 2, save: <version 2 save>, snapshots: [...] }
 *   the vanilla app's  { longgame: 1, state: <version 1 save>, snaps: [...] }
 *
 * so a file exported before the port still loads. Only the first is written.
 */

/** The shape this app writes. */
export const EXPORT_FILE_VERSION = 2

export interface ExportFile {
  /** Says the file is a Long Game export, and which shape it has. */
  readonly longgame: typeof EXPORT_FILE_VERSION
  readonly save: SavedState
  /** The account's XP history, oldest first. */
  readonly snapshots: readonly XpSnapshot[]
}

/** One account as a file holds it. */
export interface AccountBackup {
  readonly save: SavedState
  readonly snapshots: XpSnapshot[]
}

/** The file for an account's save and XP history. */
export function buildExportFile(save: SavedState, snapshots: readonly XpSnapshot[]): ExportFile {
  return { longgame: EXPORT_FILE_VERSION, save, snapshots }
}

/**
 * The name of a file made for an account: 'longgame-Lynx_Titan.json'. Anything a file system
 * might refuse is replaced with an underscore.
 */
export function accountFileName(name: string, extension: 'json' | 'png'): string {
  return `longgame-${name.replace(/[^\w-]+/g, '_')}.${extension}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A save out of a file, whichever version wrote it. On top of the version tag `readSave` looks
 * for, a file has to carry preferences (`prefs` in version 1) and a name, the two things the
 * vanilla app asked of a file before trusting it. The name may not be empty: only an account
 * can be exported, so a save without one did not come from Export.
 */
function readSavedAccount(value: unknown): SavedState | null {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name === '') return null
  if (!isRecord(value.preferences) && !isRecord(value.prefs)) return null
  const save = readSave(value)
  if (!save) return null
  // a field the file lacks takes its blank value, so a save trimmed by hand still loads
  const blank = blankSave()
  return { ...blank, ...save, preferences: { ...blank.preferences, ...save.preferences } }
}

/**
 * Reads the text of an exported file. Null when it is not a Long Game export. Snapshots that
 * are not snapshots are skipped, and a file with none gives an empty history.
 */
export function readExportFile(text: string): AccountBackup | null {
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(file)) return null

  if ('save' in file) {
    const save = readSavedAccount(file.save)
    return save && { save, snapshots: parseSnapshots(file.snapshots) }
  }
  const save = readSavedAccount(file.state)
  if (!save) return null
  const legacySnapshots = Array.isArray(file.snaps) ? file.snaps.filter(isLegacySnapshot) : []
  return { save, snapshots: migrateLegacySnapshots(legacySnapshots) }
}

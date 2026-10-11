import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PROJECT_ROOT } from './paths.ts'

/* Reading the project's own files for the launcher. Every path is given from the top of the project. */

/** The full path of a file or folder in the project. */
export function projectPath(path: string): string {
  return resolve(PROJECT_ROOT, path)
}

/** When a file or folder last changed, in milliseconds since 1970. Null when it is not there. */
export function modifiedTime(path: string): number | null {
  try {
    return statSync(projectPath(path)).mtimeMs
  } catch {
    return null
  }
}

/** A file's text. Null when it is not there. */
export function readText(path: string): string | null {
  try {
    return readFileSync(projectPath(path), 'utf8')
  } catch {
    return null
  }
}

/**
 * The latest change among the given files and folders, looking inside every folder. Paths that are not there are
 * skipped. A folder's own time counts too: it moves when a file is deleted from the folder, which no remaining
 * file would show.
 */
export function newestModifiedTime(paths: readonly string[]): number {
  let newest = 0
  for (const path of paths) {
    const own = modifiedTime(path)
    if (own === null) continue
    newest = Math.max(newest, own)
    if (!statSync(projectPath(path)).isDirectory()) continue
    for (const inside of readdirSync(projectPath(path), { recursive: true, encoding: 'utf8' })) {
      newest = Math.max(newest, modifiedTime(join(path, inside)) ?? 0)
    }
  }
  return newest
}

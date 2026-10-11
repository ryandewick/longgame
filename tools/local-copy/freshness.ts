/*
 * The launcher's decisions, as plain functions: whether the dependencies need installing, whether a local build is
 * out of date, and which port to serve on. They read no files and no clock; the launcher hands those in.
 */

/** What a finished local build records about itself. */
export interface BuildStamp {
  /** When the build started, in milliseconds since 1970. A file changed after this is not in the build. */
  startedAt: number
  /** Whether the private add-on in local/ was built in. */
  hasAddOn: boolean
}

/** The port a local copy has always used. */
export const DEFAULT_PORT = 8765

/** Reads a build stamp file. Null when there is none or it is not one, which the launcher treats as "not built". */
export function parseBuildStamp(text: string | null): BuildStamp | null {
  if (text === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  if (!('startedAt' in parsed) || typeof parsed.startedAt !== 'number') return null
  if (!('hasAddOn' in parsed) || typeof parsed.hasAddOn !== 'boolean') return null
  return { startedAt: parsed.startedAt, hasAddOn: parsed.hasAddOn }
}

/**
 * Whether the local build has to be made again: there is none, a source file is newer than it, or the private
 * add-on has been added or taken away since (taking the folder away changes no file the first check would see).
 */
export function isBuildStale(
  stamp: BuildStamp | null,
  sourcesChangedAt: number,
  hasAddOn: boolean,
): boolean {
  return stamp === null || sourcesChangedAt > stamp.startedAt || stamp.hasAddOn !== hasAddOn
}

/**
 * Whether `npm install` has to run: it never has, or package-lock.json has changed since it last did. Both times
 * are null when the file is not there.
 */
export function isInstallStale(
  installedAt: number | null,
  lockfileChangedAt: number | null,
): boolean {
  if (installedAt === null) return true
  return lockfileChangedAt !== null && lockfileChangedAt > installedAt
}

/**
 * Reads the port from LONGGAME_PORT. Unset or empty means the default. Null means it was set to something that is
 * not a port, which the launcher reports instead of guessing.
 */
export function parsePort(configured: string | undefined): number | null {
  const text = configured?.trim() ?? ''
  if (text === '') return DEFAULT_PORT
  if (!/^\d{1,5}$/.test(text)) return null
  const port = Number(text)
  return port >= 1 && port <= 65535 ? port : null
}

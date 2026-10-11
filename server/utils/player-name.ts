import { failure, success, type Result } from './result'

/** A RuneScape display name: 1 to 12 letters, digits, spaces, underscores or hyphens. */
const PLAYER_NAME_PATTERN = /^[A-Za-z0-9 _-]{1,12}$/

/**
 * Checks a display name sent by the browser and returns it trimmed.
 * The name goes into a request to Jagex and into a storage key, so nothing outside the pattern is let through.
 */
export function parsePlayerName(input: unknown): Result<string> {
  const name = typeof input === 'string' ? input.trim() : ''
  if (name === '') return failure(400, 'no name')
  if (!PLAYER_NAME_PATTERN.test(name)) {
    return failure(400, 'That does not look like a RuneScape name.')
  }
  return success(name)
}

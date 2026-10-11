const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * The sentence an API route sent with its refusal, written for the player (see
 * server/utils/errors.ts: with `$fetch` it is at `error.data.data.message`). Null when the error
 * carries none: the request never arrived, or the failure was not one the server raised on purpose.
 */
export function apiErrorMessage(error: unknown): string | null {
  if (!isRecord(error) || !isRecord(error.data) || !isRecord(error.data.data)) return null
  const { message } = error.data.data
  return typeof message === 'string' && message ? message : null
}

/** What to tell the player when a hiscores lookup fails. */
export function lookupErrorMessage(error: unknown): string {
  const fromServer = apiErrorMessage(error)
  if (fromServer) return fromServer
  // a fetch error with no status never got an answer: offline, or the server is down
  const neverAnswered = isRecord(error) && 'request' in error && error.status === undefined
  return neverAnswered
    ? 'Could not reach the lookup. Check your connection and try again.'
    : 'Could not fetch.'
}

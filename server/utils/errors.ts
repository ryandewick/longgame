/**
 * The one shape of every API error.
 *
 * A route that refuses a request throws `apiError(statusCode, message)`. Nitro answers with that HTTP status and this
 * JSON body:
 *
 *   {
 *     "error": true,
 *     "url": "/api/hiscores?name=...",
 *     "statusCode": 400,
 *     "statusMessage": "Bad Request",
 *     "message": "That does not look like a RuneScape name.",
 *     "data": { "message": "That does not look like a RuneScape name." }
 *   }
 *
 * `data.message` is the contract: a full sentence, written for the player, that the client can show as it is.
 * `message` carries the same text. `statusMessage` is only the standard name of the status, because it also travels
 * as the HTTP reason phrase, which HTTP/2 drops and which is the wrong place for a sentence.
 *
 * With `$fetch` the body is on the thrown error: `error.data.data.message`.
 *
 * Errors this code did not raise on purpose (a bug, a route that does not exist) keep Nitro's own body, which has the
 * same fields but no `data.message`; the client should fall back to its own wording for those.
 */
import type { Failure, Result } from './result'

const STATUS_NAMES: ReadonlyMap<number, string> = new Map([
  [400, 'Bad Request'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [413, 'Content Too Large'],
  [429, 'Too Many Requests'],
  [502, 'Bad Gateway'],
  [503, 'Service Unavailable'],
])

/** Builds the error a route throws to refuse a request with a message the player can be shown. */
export function apiError(statusCode: number, message: string) {
  return createError({
    statusCode,
    statusMessage: STATUS_NAMES.get(statusCode) ?? 'Error',
    message,
    data: { message },
  })
}

/** Builds the error for a refusal that a rule in this folder returned. */
export function apiErrorFrom(failure: Failure) {
  return apiError(failure.statusCode, failure.message)
}

/** Returns the value of a successful result, or throws the API error for a refused one. */
export function valueOrThrow<Value>(result: Result<Value>): Value {
  if (!result.ok) throw apiErrorFrom(result.failure)
  return result.value
}

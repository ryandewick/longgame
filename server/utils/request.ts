import type { H3Event } from 'h3'
import { apiError } from './errors'
import { parseJsonRecord, type JsonRecord } from './json'
import { isSameOrigin } from './origin'

/** Refuses a write that another website is making through the player's browser. */
export function requireSameOrigin(event: H3Event): void {
  if (!isSameOrigin(getRequestHeader(event, 'origin'), getRequestURL(event))) {
    throw apiError(403, 'Not allowed.')
  }
}

function tooLargeError() {
  return apiError(413, 'That is too much to send in one go.')
}

/**
 * Reads the request body as a JSON object, refusing anything longer than `maximumLength` characters.
 *
 * The text is parsed here whatever Content-Type the request claims. A body parser that follows the header would
 * also accept a plain HTML form post, which is the one kind of write another website can send without asking first.
 */
export async function readJsonRecord(event: H3Event, maximumLength: number): Promise<JsonRecord> {
  // refuse on the declared size first, so a body that admits to being oversized is never read into memory
  const declaredLength = Number(getRequestHeader(event, 'content-length'))
  if (declaredLength > maximumLength) throw tooLargeError()
  const text = await readRawBody(event)
  if (text && text.length > maximumLength) throw tooLargeError()
  const record = parseJsonRecord(text)
  if (!record) throw apiError(400, 'Could not read that.')
  return record
}

/**
 * The address a request came from, for the rate limiter. Cloudflare sets `CF-Connecting-IP` itself, so on the
 * website it cannot be forged; elsewhere the connection's own address is used.
 */
export function clientAddress(event: H3Event): string {
  return getRequestHeader(event, 'cf-connecting-ip') ?? getRequestIP(event) ?? 'unknown'
}

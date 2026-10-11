import { isJsonRecord } from './json'
import { failure, success, type Result } from './result'
import { discardBody, UPSTREAM_TIMEOUT_MILLISECONDS, type UpstreamClient } from './upstream-client'

const HISCORES_URL = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player='
const IRONMAN_HISCORES_URL =
  'https://secure.runescape.com/m=hiscore_oldschool_ironman/index_lite.json?player='

/** Jagex's answer exactly as they send it (`skills`, `activities`), plus when it was fetched in milliseconds. */
export interface HiscoresLookup extends Record<string, unknown> {
  fetched: number
}

/** Checks an answer that was kept in a cache: it has to be an object stamped with its fetch time. */
export function readHiscoresLookup(body: unknown): HiscoresLookup | undefined {
  return isJsonRecord(body) && typeof body.fetched === 'number'
    ? { ...body, fetched: body.fetched }
    : undefined
}

/** Which hiscores table a name is on. (The planner's own account type is `'main' | 'iron'`.) */
export type HiscoresAccountType = 'main' | 'ironman'

/** Asks Jagex for one hiscores page. Returns undefined when they could not be reached in time. */
async function requestHiscores(url: string, client: UpstreamClient): Promise<Response | undefined> {
  try {
    return await client.fetch(url, {
      headers: { 'User-Agent': client.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MILLISECONDS),
    })
  } catch {
    return undefined
  }
}

/** Looks a player up on the public hiscores. `now` supplies the time stamped on the answer. */
export async function lookUpHiscores(
  name: string,
  client: UpstreamClient,
  now: () => number,
): Promise<Result<HiscoresLookup>> {
  const response = await requestHiscores(HISCORES_URL + encodeURIComponent(name), client)
  if (!response) return failure(502, 'Could not reach the hiscores. Try again in a minute.')
  if (!response.ok) {
    await discardBody(response)
    // Jagex answers 404 both for a name nobody has and for an account too new to be ranked
    return response.status === 404
      ? failure(
          404,
          'No hiscores entry for that name. Check the spelling, and note that brand-new accounts need a few levels first.',
        )
      : failure(502, `Hiscores returned ${response.status}.`)
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  // when their servers are struggling they send an HTML page with a 200
  if (!isJsonRecord(body)) {
    return failure(502, 'The hiscores sent something unreadable. Try again in a minute.')
  }
  return success({ ...body, fetched: now() })
}

/**
 * Tells a main from an ironman. Jagex has no field for this: an account is on the ironman hiscores only if it is an
 * ironman, so a 404 from that table means a main.
 */
export async function lookUpAccountType(
  name: string,
  client: UpstreamClient,
): Promise<Result<HiscoresAccountType>> {
  const response = await requestHiscores(IRONMAN_HISCORES_URL + encodeURIComponent(name), client)
  if (!response) return failure(502, 'Could not reach the hiscores.')
  await discardBody(response)
  if (response.status === 404) return success('main')
  if (!response.ok) return failure(502, `Hiscores returned ${response.status}.`)
  return success('ironman')
}

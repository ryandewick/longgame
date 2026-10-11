/**
 * What a call to another service (Jagex's hiscores, GitHub) needs. It is passed in rather than read from globals so
 * the lookups can be tested with a stand-in `fetch`.
 */
export interface UpstreamClient {
  fetch: (url: string, init: RequestInit) => Promise<Response>
  /** Sent as the User-Agent header, so the service's owner can see who is calling and where to find us. */
  userAgent: string
}

/** How long to wait for another service before giving up. */
export const UPSTREAM_TIMEOUT_MILLISECONDS = 15_000

/** Builds the User-Agent that identifies Long Game, with the site's address when one is configured. */
export function buildUserAgent(siteUrl: string): string {
  const address = siteUrl.trim()
  return address ? `LongGame/1.0 (free fan tool; ${address})` : 'LongGame/1.0 (free fan tool)'
}

/**
 * Drops a response body we are not going to read. Workers allow only a few open connections per request, and an
 * unread body keeps its connection open.
 */
export async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel()
}

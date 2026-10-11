import type { H3Event } from 'h3'
import { parseAppMode, type AppMode } from './app-mode'
import { apiError } from './errors'
import { buildUserAgent, type UpstreamClient } from './upstream-client'

/** Whether this server is the public website or a player's local copy. */
export function appMode(event: H3Event): AppMode {
  return parseAppMode(useRuntimeConfig(event).public.mode)
}

/**
 * Refuses the request unless the server runs in `mode`. A route that belongs to the other mode answers 404, exactly
 * as if it were not there.
 */
export function requireMode(event: H3Event, mode: AppMode): void {
  if (appMode(event) !== mode) throw apiError(404, 'Not found.')
}

/** The real `fetch` and our User-Agent, for calls to Jagex and GitHub. */
export function upstreamClient(event: H3Event): UpstreamClient {
  return {
    // called through a wrapper because Workers reject a `fetch` that has been detached from the global object
    fetch: (url, init) => fetch(url, init),
    userAgent: buildUserAgent(useRuntimeConfig(event).public.siteUrl),
  }
}

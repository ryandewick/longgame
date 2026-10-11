import type { H3Event } from 'h3'
import { valueOrThrow } from '../utils/errors'
import { createExpiringCache } from '../utils/expiring-cache'
import { lookUpHiscores, readHiscoresLookup, type HiscoresLookup } from '../utils/jagex'
import {
  createEdgeLookupCache,
  createMemoryLookupCache,
  findEdgeCache,
  type LookupCache,
} from '../utils/lookup-cache'
import { parsePlayerName } from '../utils/player-name'
import { upstreamClient } from '../utils/runtime'

const CACHE_SECONDS = 60

// One answer a minute per name is plenty, and it keeps us gentle on Jagex's servers.
const recentLookupsInMemory = createMemoryLookupCache(
  createExpiringCache<HiscoresLookup>({
    lifetimeMilliseconds: CACHE_SECONDS * 1000,
    maximumEntries: 500,
  }),
)

/** On the website the answers are kept in Cloudflare's cache, which all its isolates share; elsewhere in memory. */
function recentLookups(event: H3Event): LookupCache<HiscoresLookup> {
  const edge = findEdgeCache(globalThis)
  if (!edge) return recentLookupsInMemory
  const { origin } = getRequestURL(event)
  return createEdgeLookupCache(edge, {
    lifetimeSeconds: CACHE_SECONDS,
    addressOf: (cacheKey) => `${origin}/api/hiscores?name=${encodeURIComponent(cacheKey)}`,
    read: readHiscoresLookup,
  })
}

/** GET /api/hiscores?name=: a player's levels and XP from Jagex's public hiscores. */
export default defineEventHandler(async (event) => {
  const name = valueOrThrow(parsePlayerName(getQuery(event).name))
  // names are not case sensitive, so "Zezima" and "zezima" share an entry
  const cacheKey = name.toLowerCase()
  const cache = recentLookups(event)

  let hiscores = await cache.get(cacheKey)
  if (!hiscores) {
    hiscores = valueOrThrow(await lookUpHiscores(name, upstreamClient(event), Date.now))
    await cache.set(cacheKey, hiscores)
  }
  // lets the browser reuse the answer for the same minute; every other API response is `no-store` (nuxt.config.ts)
  setResponseHeader(event, 'Cache-Control', `public, max-age=${CACHE_SECONDS}`)
  return hiscores
})

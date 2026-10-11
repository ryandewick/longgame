import { describe, expect, it } from 'vitest'
import { createExpiringCache } from '~~/server/utils/expiring-cache'
import { readHiscoresLookup } from '~~/server/utils/jagex'
import {
  createEdgeLookupCache,
  createMemoryLookupCache,
  findEdgeCache,
  type EdgeCache,
} from '~~/server/utils/lookup-cache'

interface Answer {
  level: number
}

const readAnswer = (body: unknown): Answer | undefined =>
  typeof body === 'object' && body !== null && 'level' in body && typeof body.level === 'number'
    ? { level: body.level }
    : undefined

/** A stand-in for Cloudflare's cache: responses kept by address, with a record of what was put. */
function fakeEdge() {
  const kept = new Map<string, Response>()
  const edge: EdgeCache = {
    // a response body can be read once, so each match hands out a copy, as the real cache does
    match: async (address) => kept.get(address)?.clone(),
    put: async (address, response) => {
      kept.set(address, response)
    },
  }
  return { edge, kept }
}

function answerCache(edge: EdgeCache) {
  return createEdgeLookupCache<Answer>(edge, {
    lifetimeSeconds: 60,
    addressOf: (key) => `https://longgame.tools/api/hiscores?name=${encodeURIComponent(key)}`,
    read: readAnswer,
  })
}

describe('createEdgeLookupCache', () => {
  it('returns nothing for a key it has not seen', async () => {
    expect(await answerCache(fakeEdge().edge).get('zezima')).toBeUndefined()
  })

  it('returns what was set, to any cache that shares the same edge', async () => {
    const { edge } = fakeEdge()
    await answerCache(edge).set('zezima', { level: 99 })
    // a second cache over the same edge is what another isolate would hold
    expect(await answerCache(edge).get('zezima')).toEqual({ level: 99 })
  })

  it('keeps an entry under the address made from its key', async () => {
    const { edge, kept } = fakeEdge()
    await answerCache(edge).set('iron man', { level: 1 })
    expect([...kept.keys()]).toEqual(['https://longgame.tools/api/hiscores?name=iron%20man'])
  })

  it('tells Cloudflare how long to keep an entry', async () => {
    const { edge, kept } = fakeEdge()
    await answerCache(edge).set('zezima', { level: 99 })
    const response = kept.get('https://longgame.tools/api/hiscores?name=zezima')
    expect(response?.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(response?.headers.get('Content-Type')).toBe('application/json')
  })

  it('ignores an entry that is not a value', async () => {
    const { edge, kept } = fakeEdge()
    kept.set('https://longgame.tools/api/hiscores?name=zezima', new Response('{"level":"high"}'))
    expect(await answerCache(edge).get('zezima')).toBeUndefined()
  })

  it('ignores an entry that is not JSON', async () => {
    const { edge, kept } = fakeEdge()
    kept.set('https://longgame.tools/api/hiscores?name=zezima', new Response('<html>'))
    expect(await answerCache(edge).get('zezima')).toBeUndefined()
  })

  it('carries on when the cache cannot be read or written', async () => {
    const broken: EdgeCache = {
      match: async () => {
        throw new Error('cache is down')
      },
      put: async () => {
        throw new Error('cache is down')
      },
    }
    const cache = answerCache(broken)
    expect(await cache.get('zezima')).toBeUndefined()
    await expect(cache.set('zezima', { level: 99 })).resolves.toBeUndefined()
  })
})

describe('createMemoryLookupCache', () => {
  it('keeps answers in the expiring cache it is given', async () => {
    const clock = { time: 0 }
    const cache = createMemoryLookupCache(
      createExpiringCache<Answer>({
        lifetimeMilliseconds: 60_000,
        maximumEntries: 10,
        now: () => clock.time,
      }),
    )
    await cache.set('zezima', { level: 99 })
    expect(await cache.get('zezima')).toEqual({ level: 99 })
    clock.time = 60_000
    expect(await cache.get('zezima')).toBeUndefined()
  })
})

describe('findEdgeCache', () => {
  it('finds nothing in Node, which has no `caches`', () => {
    expect(findEdgeCache(globalThis)).toBeUndefined()
    expect(findEdgeCache({})).toBeUndefined()
  })

  it('finds nothing where `caches` has no default cache, as in a browser', () => {
    expect(findEdgeCache({ caches: {} })).toBeUndefined()
    expect(findEdgeCache({ caches: { default: 'not a cache' } })).toBeUndefined()
  })

  it("finds a Worker's default cache", () => {
    const { edge } = fakeEdge()
    expect(findEdgeCache({ caches: { default: edge } })).toBe(edge)
  })
})

describe('readHiscoresLookup', () => {
  it('accepts an answer stamped with its fetch time', () => {
    const lookup = { skills: [{ name: 'Overall', level: 2277 }], fetched: 1_700_000_000_000 }
    expect(readHiscoresLookup(lookup)).toEqual(lookup)
  })

  it('refuses anything else', () => {
    expect(readHiscoresLookup({ skills: [] })).toBeUndefined()
    expect(readHiscoresLookup({ fetched: 'yesterday' })).toBeUndefined()
    expect(readHiscoresLookup([])).toBeUndefined()
    expect(readHiscoresLookup(null)).toBeUndefined()
  })
})

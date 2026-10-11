import type { ExpiringCache } from './expiring-cache'

/**
 * Where a route keeps an answer it may give again, so a second request for the same thing inside the answer's
 * lifetime does not go back to the service it came from.
 *
 * There are two kinds. On the website the answers go in Cloudflare's cache, which every isolate in a data centre
 * shares, so "one lookup a minute per name" holds however many isolates are running. Everywhere else (a local copy,
 * `nuxt dev`, a test) there is one server process and its own memory does the same job.
 */
export interface LookupCache<Value> {
  get(key: string): Promise<Value | undefined>
  set(key: string, value: Value): Promise<void>
}

/**
 * The part of Cloudflare's Cache API this uses (`caches.default` in a Worker). An entry is a response kept under
 * an address; Cloudflare drops it when the lifetime in its Cache-Control header has passed.
 */
export interface EdgeCache {
  match(address: string): Promise<Response | undefined>
  put(address: string, response: Response): Promise<void>
}

export interface EdgeLookupCacheOptions<Value> {
  lifetimeSeconds: number
  /** The address an entry is kept under. It has to be a full http(s) address; nothing is ever fetched from it. */
  addressOf: (key: string) => string
  /** Checks what came back out of the cache. Undefined means it is not a value, and the entry is ignored. */
  read: (body: unknown) => Value | undefined
}

/** A lookup cache kept in Cloudflare's cache. */
export function createEdgeLookupCache<Value>(
  edge: EdgeCache,
  options: EdgeLookupCacheOptions<Value>,
): LookupCache<Value> {
  const { lifetimeSeconds, addressOf, read } = options
  return {
    // The cache only saves work. If it cannot be read or written the answer is fetched again, never refused.
    async get(key) {
      try {
        const kept = await edge.match(addressOf(key))
        return kept ? read(await kept.json()) : undefined
      } catch {
        return undefined
      }
    },
    async set(key, value) {
      const response = new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${lifetimeSeconds}`,
        },
      })
      try {
        await edge.put(addressOf(key), response)
      } catch (error) {
        console.warn('Could not keep an answer in the cache.', error)
      }
    },
  }
}

/** A lookup cache kept in this process's memory. */
export function createMemoryLookupCache<Value>(memory: ExpiringCache<Value>): LookupCache<Value> {
  return {
    get: async (key) => memory.get(key),
    set: async (key, value) => memory.set(key, value),
  }
}

/** Whether a value has the two methods of a cache this needs. */
export function isEdgeCache(value: unknown): value is EdgeCache {
  return (
    typeof value === 'object' &&
    value !== null &&
    'match' in value &&
    typeof value.match === 'function' &&
    'put' in value &&
    typeof value.put === 'function'
  )
}

/**
 * Cloudflare's cache, when the server is running on Cloudflare. A Worker has it as `caches.default`; Node has no
 * `caches` at all, so everywhere else this is undefined. `globalScope` is `globalThis`, passed in so a test can
 * stand in for a Worker.
 */
export function findEdgeCache(globalScope: object): EdgeCache | undefined {
  const cacheStorage: unknown = Reflect.get(globalScope, 'caches')
  if (typeof cacheStorage !== 'object' || cacheStorage === null) return undefined
  const defaultCache: unknown = Reflect.get(cacheStorage, 'default')
  return isEdgeCache(defaultCache) ? defaultCache : undefined
}

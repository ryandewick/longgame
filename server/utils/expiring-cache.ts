export interface ExpiringCache<Value> {
  /** The value stored under `key`, unless it has expired. */
  get(key: string): Value | undefined
  set(key: string, value: Value): void
}

export interface ExpiringCacheOptions {
  lifetimeMilliseconds: number
  /** The most entries to hold. When full, expired entries go first, then the oldest. */
  maximumEntries: number
  /** The clock, passed in so tests can move time. Defaults to the real one. */
  now?: () => number
}

/**
 * A small cache held in memory, where every entry expires after a fixed time.
 *
 * Like the rate limiter, the memory belongs to one server process (on Cloudflare Workers, one isolate), so this
 * saves repeat work rather than guaranteeing it never happens twice. The entry cap matters on Workers, where an
 * isolate has little memory.
 */
export function createExpiringCache<Value>(options: ExpiringCacheOptions): ExpiringCache<Value> {
  const { lifetimeMilliseconds, maximumEntries, now = Date.now } = options
  // a Map remembers insertion order, so its first key is always the oldest entry
  const entries = new Map<string, { value: Value; expiresAt: number }>()

  function removeExpired(time: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= time) entries.delete(key)
    }
  }

  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= now()) {
        entries.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key, value) {
      const time = now()
      // deleting first moves a refreshed key to the end, so insertion order stays oldest-first
      entries.delete(key)
      if (entries.size >= maximumEntries) removeExpired(time)
      if (entries.size >= maximumEntries) {
        const oldestKey = entries.keys().next().value
        if (oldestKey !== undefined) entries.delete(oldestKey)
      }
      entries.set(key, { value, expiresAt: time + lifetimeMilliseconds })
    },
  }
}

export interface RateLimiter {
  /** Records one attempt for `key` and says whether it is within the limit. A refused attempt is not recorded. */
  allow(key: string): boolean
}

export interface RateLimiterOptions {
  /** How many attempts one key may make inside the window. */
  limit: number
  windowMilliseconds: number
  /** How many keys to remember before starting again from empty. */
  maximumKeys: number
  /** The clock, passed in so tests can move time. Defaults to the real one. */
  now?: () => number
}

/**
 * A sliding-window limiter held in memory.
 *
 * This is a courtesy limit, not a firm one. The memory belongs to one server process, and on Cloudflare Workers to
 * one isolate: Cloudflare runs many isolates and restarts them freely, so a determined sender can get more through.
 * It is enough to stop a stuck form or a bored player. A firm limit belongs in a Cloudflare rate limiting rule on the
 * route.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMilliseconds, maximumKeys, now = Date.now } = options
  const attemptsByKey = new Map<string, number[]>()

  return {
    allow(key) {
      const time = now()
      const recentAttempts = (attemptsByKey.get(key) ?? []).filter(
        (attempt) => time - attempt < windowMilliseconds,
      )
      const allowed = recentAttempts.length < limit
      if (allowed) recentAttempts.push(time)
      attemptsByKey.set(key, recentAttempts)
      // Forgetting everyone now and then keeps the memory bounded. For a courtesy limit that is a fair trade against
      // tracking which keys have gone quiet.
      if (attemptsByKey.size > maximumKeys) attemptsByKey.clear()
      return allowed
    },
  }
}

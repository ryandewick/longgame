import { describe, expect, it } from 'vitest'
import { createExpiringCache } from '~~/server/utils/expiring-cache'

/** A one minute cache of numbers, with a clock the test moves by hand. */
function cacheWithClock(maximumEntries = 100) {
  const clock = { time: 1_000_000 }
  const cache = createExpiringCache<number>({
    lifetimeMilliseconds: 60_000,
    maximumEntries,
    now: () => clock.time,
  })
  return { cache, clock }
}

describe('createExpiringCache', () => {
  it('returns nothing for a key it has not seen', () => {
    expect(cacheWithClock().cache.get('zezima')).toBeUndefined()
  })

  it('returns a value until its lifetime has passed', () => {
    const { cache, clock } = cacheWithClock()
    cache.set('zezima', 1)
    clock.time += 59_999
    expect(cache.get('zezima')).toBe(1)
    clock.time += 1
    expect(cache.get('zezima')).toBeUndefined()
  })

  it('starts a new lifetime when a key is set again', () => {
    const { cache, clock } = cacheWithClock()
    cache.set('zezima', 1)
    clock.time += 50_000
    cache.set('zezima', 2)
    clock.time += 50_000
    expect(cache.get('zezima')).toBe(2)
  })

  it('makes room by dropping expired entries first', () => {
    const { cache, clock } = cacheWithClock(2)
    cache.set('old', 1)
    clock.time += 30_000
    cache.set('recent', 2)
    clock.time += 30_000
    cache.set('new', 3)
    expect(cache.get('old')).toBeUndefined()
    expect(cache.get('recent')).toBe(2)
    expect(cache.get('new')).toBe(3)
  })

  it('drops the oldest entry when it is full and nothing has expired', () => {
    const { cache } = cacheWithClock(2)
    cache.set('first', 1)
    cache.set('second', 2)
    cache.set('third', 3)
    expect(cache.get('first')).toBeUndefined()
    expect(cache.get('second')).toBe(2)
    expect(cache.get('third')).toBe(3)
  })

  it('counts a refreshed key as new when choosing the oldest', () => {
    const { cache } = cacheWithClock(2)
    cache.set('first', 1)
    cache.set('second', 2)
    cache.set('first', 10)
    cache.set('third', 3)
    expect(cache.get('first')).toBe(10)
    expect(cache.get('second')).toBeUndefined()
  })
})

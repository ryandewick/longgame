import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '~~/server/utils/rate-limiter'

const TEN_MINUTES = 10 * 60 * 1000

/** A limiter of three per ten minutes, with a clock the test moves by hand. */
function limiterWithClock(maximumKeys = 5000) {
  const clock = { time: 1_000_000 }
  const limiter = createRateLimiter({
    limit: 3,
    windowMilliseconds: TEN_MINUTES,
    maximumKeys,
    now: () => clock.time,
  })
  return { limiter, clock }
}

describe('createRateLimiter', () => {
  it('allows up to the limit, then refuses', () => {
    const { limiter } = limiterWithClock()
    expect([1, 2, 3, 4, 5].map(() => limiter.allow('203.0.113.7'))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ])
  })

  it('counts each key on its own', () => {
    const { limiter } = limiterWithClock()
    for (let attempt = 0; attempt < 3; attempt++) limiter.allow('203.0.113.7')
    expect(limiter.allow('203.0.113.7')).toBe(false)
    expect(limiter.allow('198.51.100.2')).toBe(true)
  })

  it('allows again once the earliest attempt has left the window', () => {
    const { limiter, clock } = limiterWithClock()
    limiter.allow('key')
    clock.time += 60_000
    limiter.allow('key')
    limiter.allow('key')

    clock.time += TEN_MINUTES - 60_001
    expect(limiter.allow('key')).toBe(false)
    clock.time += 1
    expect(limiter.allow('key')).toBe(true)
    // the other two attempts are still inside the window
    expect(limiter.allow('key')).toBe(false)
  })

  it('does not count refused attempts, so hammering does not extend the wait', () => {
    const { limiter, clock } = limiterWithClock()
    for (let attempt = 0; attempt < 3; attempt++) limiter.allow('key')
    clock.time += TEN_MINUTES - 1
    expect(limiter.allow('key')).toBe(false)
    clock.time += 1
    expect(limiter.allow('key')).toBe(true)
  })

  it('forgets everything once it holds more keys than the maximum', () => {
    const { limiter } = limiterWithClock(2)
    for (let attempt = 0; attempt < 3; attempt++) limiter.allow('first')
    expect(limiter.allow('first')).toBe(false)
    limiter.allow('second')
    limiter.allow('third')
    expect(limiter.allow('first')).toBe(true)
  })
})

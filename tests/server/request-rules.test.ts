import { describe, expect, it } from 'vitest'
import { parseAppMode } from '~~/server/utils/app-mode'
import { isJsonRecord, parseJsonRecord } from '~~/server/utils/json'
import { isSameOrigin } from '~~/server/utils/origin'
import { failure, success } from '~~/server/utils/result'
import { buildUserAgent } from '~~/server/utils/upstream-client'

describe('parseAppMode', () => {
  it("is local only for exactly 'local'", () => {
    expect(parseAppMode('local')).toBe('local')
  })

  it.each(['hosted', '', 'Local', 'LOCAL', ' local', 'true', undefined, null, 1])(
    'falls back to hosted for %j',
    (configured) => {
      expect(parseAppMode(configured)).toBe('hosted')
    },
  )
})

describe('isSameOrigin', () => {
  const requestUrl = new URL('https://longgame.tools/api/suggestions')

  it('accepts a request from our own pages', () => {
    expect(isSameOrigin('https://longgame.tools', requestUrl)).toBe(true)
  })

  it('accepts a request with no Origin header', () => {
    expect(isSameOrigin(undefined, requestUrl)).toBe(true)
  })

  it.each([
    'https://example.com',
    'http://longgame.tools',
    'https://longgame.tools:8443',
    'https://www.longgame.tools',
    'null',
  ])('refuses a request from %s', (origin) => {
    expect(isSameOrigin(origin, requestUrl)).toBe(false)
  })
})

describe('parseJsonRecord', () => {
  it('parses a JSON object', () => {
    expect(parseJsonRecord('{"skill":"mining","level":72}')).toEqual({ skill: 'mining', level: 72 })
  })

  it.each([undefined, '', 'not json', '{"cut": ', '[1,2]', '"text"', '42', 'null'])(
    'returns undefined for %j',
    (text) => {
      expect(parseJsonRecord(text)).toBeUndefined()
    },
  )
})

describe('isJsonRecord', () => {
  it('is true only for plain objects', () => {
    expect(isJsonRecord({})).toBe(true)
    expect(isJsonRecord([])).toBe(false)
    expect(isJsonRecord(null)).toBe(false)
    expect(isJsonRecord('text')).toBe(false)
  })
})

describe('buildUserAgent', () => {
  it('names the tool and where to find it', () => {
    expect(buildUserAgent('https://longgame.tools')).toBe(
      'LongGame/1.0 (free fan tool; https://longgame.tools)',
    )
  })

  it('leaves the address out when none is configured', () => {
    expect(buildUserAgent('')).toBe('LongGame/1.0 (free fan tool)')
    expect(buildUserAgent('  ')).toBe('LongGame/1.0 (free fan tool)')
  })
})

describe('success and failure', () => {
  it('build the two kinds of result', () => {
    expect(success(72)).toEqual({ ok: true, value: 72 })
    expect(failure(400, 'Pick a skill.')).toEqual({
      ok: false,
      failure: { statusCode: 400, message: 'Pick a skill.' },
    })
  })
})

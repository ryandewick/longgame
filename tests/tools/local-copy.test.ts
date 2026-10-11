import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PORT,
  isBuildStale,
  isInstallStale,
  parseBuildStamp,
  parsePort,
} from '~~/tools/local-copy/freshness'

describe('parseBuildStamp', () => {
  it('reads the stamp a finished build writes', () => {
    expect(parseBuildStamp('{"startedAt":1000,"hasAddOn":false}')).toEqual({
      startedAt: 1000,
      hasAddOn: false,
    })
  })

  it('reads a missing stamp as no build', () => {
    expect(parseBuildStamp(null)).toBeNull()
  })

  it.each([
    '',
    'not json',
    'null',
    '[]',
    '{}',
    '{"startedAt":"today","hasAddOn":false}',
    '{"startedAt":1}',
  ])('reads %j as no build', (text) => {
    expect(parseBuildStamp(text)).toBeNull()
  })
})

describe('isBuildStale', () => {
  const stamp = { startedAt: 1000, hasAddOn: false }

  it('builds when there is no build', () => {
    expect(isBuildStale(null, 0, false)).toBe(true)
  })

  it('keeps a build that is newer than every source', () => {
    expect(isBuildStale(stamp, 999, false)).toBe(false)
    expect(isBuildStale(stamp, 1000, false)).toBe(false)
  })

  it('builds again when a source changed after the build started', () => {
    expect(isBuildStale(stamp, 1001, false)).toBe(true)
  })

  it('builds again when the add-on has been added or taken away', () => {
    expect(isBuildStale(stamp, 999, true)).toBe(true)
    expect(isBuildStale({ startedAt: 1000, hasAddOn: true }, 999, false)).toBe(true)
    expect(isBuildStale({ startedAt: 1000, hasAddOn: true }, 999, true)).toBe(false)
  })
})

describe('isInstallStale', () => {
  it('installs when nothing has been installed', () => {
    expect(isInstallStale(null, 500)).toBe(true)
    expect(isInstallStale(null, null)).toBe(true)
  })

  it('installs again when package-lock.json is newer than the last install', () => {
    expect(isInstallStale(1000, 1001)).toBe(true)
  })

  it('does not install when the last install is the newer', () => {
    expect(isInstallStale(1000, 1000)).toBe(false)
    expect(isInstallStale(1000, 999)).toBe(false)
    expect(isInstallStale(1000, null)).toBe(false)
  })
})

describe('parsePort', () => {
  it('uses 8765 when no port is set', () => {
    expect(DEFAULT_PORT).toBe(8765)
    expect(parsePort(undefined)).toBe(8765)
    expect(parsePort('')).toBe(8765)
    expect(parsePort('  ')).toBe(8765)
  })

  it('reads a port number', () => {
    expect(parsePort('9000')).toBe(9000)
    expect(parsePort(' 80 ')).toBe(80)
    expect(parsePort('65535')).toBe(65535)
  })

  it.each(['0', '65536', '99999', '-1', '80.5', '8765abc', 'http', '0x50'])(
    'refuses %j rather than guessing',
    (configured) => {
      expect(parsePort(configured)).toBeNull()
    },
  )
})

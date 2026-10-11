import { describe, expect, it } from 'vitest'
import {
  CACHE_BUT_CHECK_FIRST,
  CACHE_FOR_A_YEAR,
  SECURITY_HEADERS,
  buildHeadersFile,
  staticFileHeaderRules,
  type StaticHeaderRule,
} from '#shared/domain/site-headers'

/** Turns a rule's path into a test, the way Cloudflare reads it: `*` stands for anything. */
function matches(rule: StaticHeaderRule, address: string): boolean {
  const pattern = rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '.*')
  return new RegExp(`^${pattern}$`).test(address)
}

/**
 * The headers a file ends up with. Cloudflare applies every matching rule from the top down, and each rule of ours
 * replaces the headers it sets, so the last one to set a header wins.
 */
function headersFor(address: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const rule of staticFileHeaderRules('/_nuxt/')) {
    if (matches(rule, address)) Object.assign(headers, rule.headers)
  }
  return headers
}

describe('the headers on files Cloudflare serves', () => {
  it('puts the security headers on every file', () => {
    for (const address of ['/', '/skills', '/guides/mining/', '/og.png', '/_nuxt/entry.abc.js']) {
      expect(headersFor(address)).toMatchObject(SECURITY_HEADERS)
    }
  })

  it('forbids framing by both the old header and the new one', () => {
    expect(SECURITY_HEADERS['x-frame-options']).toBe('DENY')
    expect(SECURITY_HEADERS['content-security-policy']).toBe("frame-ancestors 'none'")
  })

  it('lets the browser keep game art, fonts and hashed build files for a year', () => {
    expect(headersFor('/assets/osrs/capes-md/mining.webp')['cache-control']).toBe(CACHE_FOR_A_YEAR)
    expect(headersFor('/assets/fonts/figtree.woff2')['cache-control']).toBe(CACHE_FOR_A_YEAR)
    expect(headersFor('/_nuxt/B0M5u13G.js')['cache-control']).toBe(CACHE_FOR_A_YEAR)
    expect(headersFor('/_nuxt/builds/meta/653becdc.json')['cache-control']).toBe(CACHE_FOR_A_YEAR)
  })

  it('has the browser check for a newer build every time', () => {
    expect(headersFor('/_nuxt/builds/latest.json')['cache-control']).toBe(CACHE_BUT_CHECK_FIRST)
  })

  it('sets no cache lifetime on a page, which leaves Cloudflare to check with the browser each time', () => {
    expect(headersFor('/')).not.toHaveProperty('cache-control')
    expect(headersFor('/guides/mining/')).not.toHaveProperty('cache-control')
    expect(headersFor('/sitemap.xml')).not.toHaveProperty('cache-control')
  })

  it('follows the build folder it is given', () => {
    const paths = staticFileHeaderRules('/_build/').map((rule) => rule.path)
    expect(paths).toContain('/_build/*')
    expect(paths).toContain('/_build/builds/meta/*')
  })
})

describe('buildHeadersFile', () => {
  it('writes each rule as a path, the headers it replaces, then the headers it sets', () => {
    const file = buildHeadersFile([
      { path: '/*', headers: { 'x-frame-options': 'DENY' } },
      { path: '/assets/*', headers: { 'cache-control': 'public, max-age=60' } },
    ])
    expect(file).toBe(
      [
        '/*',
        '  ! x-frame-options',
        '  x-frame-options: DENY',
        '/assets/*',
        '  ! cache-control',
        '  cache-control: public, max-age=60',
        '',
      ].join('\n'),
    )
  })

  it('takes a header away before every rule that sets it, so two rules never join their values', () => {
    const lines = buildHeadersFile(staticFileHeaderRules('/_nuxt/')).split('\n')
    let cacheLineCount = 0
    lines.forEach((line, index) => {
      if (!line.startsWith('  cache-control:')) return
      cacheLineCount += 1
      expect(lines[index - 1]).toBe('  ! cache-control')
    })
    expect(cacheLineCount).toBe(4)
  })

  it('lists a general rule before the particular ones that override it', () => {
    const paths = staticFileHeaderRules('/_nuxt/').map((rule) => rule.path)
    expect(paths.indexOf('/_nuxt/*')).toBeLessThan(paths.indexOf('/_nuxt/builds/*'))
    expect(paths.indexOf('/_nuxt/builds/*')).toBeLessThan(paths.indexOf('/_nuxt/builds/meta/*'))
  })
})

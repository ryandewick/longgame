import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BRAND_MARK_RESTING_PROGRESS,
  brandMarkFaviconUrl,
  brandMarkFillPath,
  isBrandMarkComplete,
} from '~~/app/utils/brand-mark'

describe('brandMarkFillPath', () => {
  it('draws nothing until there is enough progress to see', () => {
    expect(brandMarkFillPath(0)).toBeNull()
    expect(brandMarkFillPath(0.004)).toBeNull()
    expect(brandMarkFillPath(-1)).toBeNull()
  })

  it('starts at the top of the ring and runs clockwise', () => {
    // a quarter of the way round ends at three o'clock
    expect(brandMarkFillPath(0.25)).toBe('M32 12A14 14 0 0 1 46.00 26.00')
  })

  it('takes the long way round past the half', () => {
    expect(brandMarkFillPath(0.5)).toBe('M32 12A14 14 0 0 1 32.00 40.00')
    // the resting mark: three quarters, ending at nine o'clock
    expect(brandMarkFillPath(BRAND_MARK_RESTING_PROGRESS)).toBe('M32 12A14 14 0 1 1 18.00 26.00')
  })

  it('stops just short of a full circle, which one arc cannot draw', () => {
    expect(brandMarkFillPath(1)).toBe(brandMarkFillPath(0.9999))
    expect(brandMarkFillPath(1)).toBe(brandMarkFillPath(3))
    expect(brandMarkFillPath(1)).toMatch(/^M32 12A14 14 0 1 1 31\.99 12\.00$/)
  })
})

describe('isBrandMarkComplete', () => {
  it('is only true at max', () => {
    expect(isBrandMarkComplete(0.9999)).toBe(false)
    expect(isBrandMarkComplete(1)).toBe(true)
  })
})

describe('brandMarkFaviconUrl', () => {
  const svgOf = (progress: number) =>
    decodeURIComponent(brandMarkFaviconUrl(progress).replace('data:image/svg+xml,', ''))

  it('is an SVG data URL of the mark on the yellow tile', () => {
    expect(brandMarkFaviconUrl(0.5)).toMatch(/^data:image\/svg\+xml,/)
    expect(svgOf(0.5)).toContain('<rect width="64" height="64" rx="14" fill="#ffff00"/>')
    expect(svgOf(0.5)).toContain(`d="${brandMarkFillPath(0.5)}"`)
  })

  it('leaves the tail unfilled until the account is maxed', () => {
    const tail = (progress: number) => /<path d="M46 26[^"]*" stroke="(#\w+)"/.exec(svgOf(progress))
    expect(tail(0.99)?.[1]).toBe('#7d7a0a')
    expect(tail(1)?.[1]).toBe('#16120f')
  })

  it('draws no filled arc for an account that has barely started', () => {
    expect(svgOf(0).match(/<path/g)).toHaveLength(1)
  })
})

describe('public/favicon.svg', () => {
  it('is the mark at rest, as a file a search engine can fetch', () => {
    // written by tools/social/icons.mjs: run it again when the mark changes
    const file = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8').trim()
    const drawn = decodeURIComponent(
      brandMarkFaviconUrl(BRAND_MARK_RESTING_PROGRESS).slice('data:image/svg+xml,'.length),
    )
    expect(file).toBe(drawn)
  })
})

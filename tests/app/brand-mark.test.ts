import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRAND_MARK_NINE, brandMarkPlacement, brandMarkSvg } from '~~/app/utils/brand-mark'

describe('the icon', () => {
  it('is the 99: two of the wordmark’s 9s, the second cut free of the first by a hairline', () => {
    const svg = brandMarkSvg()
    const nines = svg.match(/<path d="([^"]+)"/g) ?? []
    // the first 9, the cut round the second, the second 9
    expect(nines).toHaveLength(3)
    for (const nine of nines) expect(nine).toBe(`<path d="${BRAND_MARK_NINE}"`)
    expect(svg).toContain('fill="#191411" stroke="#191411" stroke-width="44"')
    expect(svg.match(/fill="#ffff00"/g)).toHaveLength(2)
  })

  it('sits on the dark tile with its edge, the shape the favicon has always had', () => {
    expect(brandMarkSvg()).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#191411" stroke="#3b3129" stroke-width="2"\/>/,
    )
  })

  it('keeps the 99 centred on the tile, clear of its edges', () => {
    const { scale, x, y, step } = brandMarkPlacement()
    const width = (step + 528) * scale
    const height = 752 * scale
    // centred both ways
    expect(x + width / 2).toBeCloseTo(32)
    expect(y - height / 2).toBeCloseTo(32)
    // at least 8 of the 64 units clear on every side
    expect(x).toBeGreaterThanOrEqual(8 - 1e-9)
    expect(y - height).toBeGreaterThanOrEqual(8 - 1e-9)
    // the bowls meet: the second 9 starts before the first one ends
    expect(step).toBeLessThan(528)
  })
})

describe('public/favicon.svg', () => {
  it('is the icon the app draws, as a file a search engine can fetch', () => {
    // written by tools/social/icons.mjs: run it again when the icon changes
    const file = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8').trim()
    expect(file).toBe(brandMarkSvg())
  })
})

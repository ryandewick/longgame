/*
 * The icon: the 99 the wordmark hides, pulled out on its own. Both 9s are the wordmark's Poppins
 * 800 9, tracked in until their bowls meet, with a hairline of the tile's colour cut round the
 * second so they read as one 99. Stat yellow on the dark tile, drawn on a 64 unit square that is
 * the tile itself.
 *
 * It is only for places that need a square (the favicon files, the home screen icon, the holding
 * page). The header and the share picture show the wordmark on its own, so two 99s never sit side
 * by side.
 */

/**
 * Poppins 800's 9 (SIL Open Font License), in font units: y runs up, and the outline spans
 * 41 to 569 across and -5 to 747 up.
 */
export const BRAND_MARK_NINE =
  'M316 153Q361 153 377.5 195.5Q394 238 394 332Q374 303 338.0 286.0Q302 269 257 269Q161 269 101.0 329.0' +
  'Q41 389 41 502Q41 576 72.0 631.5Q103 687 160.5 717.0Q218 747 295 747Q448 747 508.5 654.5Q569 562 569 386' +
  'Q569 189 510.5 92.0Q452 -5 310 -5Q233 -5 177.5 26.5Q122 58 92.5 109.5Q63 161 59 221H242Q254 153 316 153Z' +
  'M379 497Q379 537 358.5 557.0Q338 577 302 577Q266 577 245.5 556.5Q225 536 225 498Q225 463 245.5 442.0' +
  'Q266 421 304 421Q339 421 359.0 441.5Q379 462 379 497Z'

const NINE_BOUNDS = { left: 41, bottom: -5, width: 528, height: 752 } as const

/** The second 9 starts this share of a 9's width along from the first: close enough for the bowls to meet. */
const STEP = 0.8

/** The cut round the second 9, in font units. */
const GAP = 22

/** The clear space kept round the 99 on the tile, in the 64 unit square. */
const MARGIN = 8

// An icon file cannot read the page's custom properties: these repeat --color-bg, --color-edge
// and --color-stat from tokens.scss.
const TILE_COLOUR = '#191411'
const EDGE_COLOUR = '#3b3129'
const NINE_COLOUR = '#ffff00'

/** Where the 99 sits on the tile: its scale from font units, and where its bottom left lands. */
export function brandMarkPlacement(): { scale: number; x: number; y: number; step: number } {
  const step = NINE_BOUNDS.width * STEP
  const width = step + NINE_BOUNDS.width
  const scale = Math.min((64 - 2 * MARGIN) / width, (64 - 2 * MARGIN) / NINE_BOUNDS.height)
  return {
    scale,
    x: 32 - (width * scale) / 2,
    y: 32 + (NINE_BOUNDS.height * scale) / 2,
    step,
  }
}

const round = (value: number): number => Math.round(value * 10000) / 10000

/** The icon on its tile as a standalone SVG, for the icon files (tools/social/icons.mjs). */
export function brandMarkSvg(): string {
  const { scale, x, y, step } = brandMarkPlacement()
  const at = (dx: number): string =>
    `translate(${round(dx - NINE_BOUNDS.left)} ${-NINE_BOUNDS.bottom})`
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    `<rect x="1" y="1" width="62" height="62" rx="14" fill="${TILE_COLOUR}" stroke="${EDGE_COLOUR}" stroke-width="2"/>` +
    `<g transform="translate(${round(x)} ${round(y)}) scale(${round(scale)} ${round(-scale)})">` +
    `<path d="${BRAND_MARK_NINE}" transform="${at(0)}" fill="${NINE_COLOUR}"/>` +
    `<path d="${BRAND_MARK_NINE}" transform="${at(step)}" fill="${TILE_COLOUR}" stroke="${TILE_COLOUR}" ` +
    `stroke-width="${GAP * 2}" stroke-linejoin="round"/>` +
    `<path d="${BRAND_MARK_NINE}" transform="${at(step)}" fill="${NINE_COLOUR}"/>` +
    '</g></svg>'
  )
}

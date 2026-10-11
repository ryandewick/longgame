/*
 * The mark: one ring and a tail, a 9 and a g at once, drawn on a 64 unit square. The ring fills
 * clockwise from the top with the account's progress to max, so every player's icon is their
 * own. The tail only fills when the account is maxed.
 */

/** The ring: its centre, radius and stroke on the 64 unit canvas. */
export const BRAND_MARK_RING = { centreX: 32, centreY: 26, radius: 14, strokeWidth: 9.5 } as const

/** The tail drops from the right of the ring and hooks left. */
export const BRAND_MARK_TAIL = 'M46 26V37c0 9.5-6 15-15 15h-5'

/** What the mark shows outside the app and before an account is loaded: three quarters. */
export const BRAND_MARK_RESTING_PROGRESS = 0.75

/** Below this share of a turn the filled arc would be a speck, so none is drawn. */
const SMALLEST_ARC = 0.004

/** A full circle cannot be drawn as one arc (its ends would meet), so the fill stops just short. */
const FULLEST_ARC = 0.9999

/** Has the account reached max, which is when the tail fills too? `progress` runs from 0 to 1. */
export function isBrandMarkComplete(progress: number): boolean {
  return progress >= 1
}

/**
 * The path of the filled part of the ring for this much progress (0 to 1), or null when there is
 * too little to draw.
 */
export function brandMarkFillPath(progress: number): string | null {
  const share = Math.max(0, Math.min(FULLEST_ARC, progress))
  if (share <= SMALLEST_ARC) return null
  const { centreX, centreY, radius } = BRAND_MARK_RING
  const angle = share * 2 * Math.PI
  const endX = (centreX + radius * Math.sin(angle)).toFixed(2)
  const endY = (centreY - radius * Math.cos(angle)).toFixed(2)
  const largeArc = share > 0.5 ? 1 : 0
  return `M${centreX} ${centreY - radius}A${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`
}

// A favicon is an image file, so it cannot read the page's custom properties: these three repeat
// --color-stat, --color-stat-unfilled and --color-ink from tokens.scss.
const TILE_COLOUR = '#ffff00'
const UNFILLED_COLOUR = '#7d7a0a'
const FILLED_COLOUR = '#16120f'

/** The favicon for this much progress to max (0 to 1): the mark at 80% on the yellow tile, as a data URL. */
export function brandMarkFaviconUrl(progress: number): string {
  const { centreX, centreY, radius, strokeWidth } = BRAND_MARK_RING
  const fillPath = brandMarkFillPath(progress)
  const tailColour = isBrandMarkComplete(progress) ? FILLED_COLOUR : UNFILLED_COLOUR
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    `<rect width="64" height="64" rx="14" fill="${TILE_COLOUR}"/>` +
    `<g transform="translate(6.4 6.4) scale(.8)" fill="none" stroke-width="${strokeWidth}">` +
    `<circle cx="${centreX}" cy="${centreY}" r="${radius}" stroke="${UNFILLED_COLOUR}"/>` +
    `<path d="${BRAND_MARK_TAIL}" stroke="${tailColour}"/>` +
    (fillPath ? `<path d="${fillPath}" stroke="${FILLED_COLOUR}"/>` : '') +
    '</g></svg>'
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

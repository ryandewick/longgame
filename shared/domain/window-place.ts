/*
 * Where the desktop app's window was last left: its position and size on the screen, in the same units the page reads
 * (screenX, outerWidth...) and Chrome is told (--window-position, --window-size). The page reports it to a local copy's
 * server, which keeps it, and the launcher opens the next window there (tools/local-copy). This file imports nothing,
 * because the launcher, which Node runs directly, reads it too.
 */

export interface WindowPlace {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Smaller than this, the planner is no use; a figure below it is not a real window. */
export const SMALLEST_WINDOW = { width: 400, height: 300 }

/** Further than this from the screen's corner, in any direction, is no screen a player has. */
const FURTHEST_COORDINATE = 20_000

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Reads a window place from wherever it came from (the page's report, the file it is kept in). Null when it is not
 * one: missing or fractional figures, a window too small to be real, or one placed beyond any screen.
 */
export function readWindowPlace(value: unknown): WindowPlace | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  if (!isWhole(x) || !isWhole(y) || !isWhole(width) || !isWhole(height)) return null
  const within = (coordinate: number): boolean => Math.abs(coordinate) <= FURTHEST_COORDINATE
  if (!within(x) || !within(y) || !within(width) || !within(height)) return null
  if (width < SMALLEST_WINDOW.width || height < SMALLEST_WINDOW.height) return null
  return { x, y, width, height }
}

import { readWindowPlace } from '#shared/domain/window-place'
import { apiError } from '../utils/errors'
import { writeWindowPlace } from '../utils/local-saves'
import { readJsonRecord, requireSameOrigin } from '../utils/request'
import { requireMode } from '../utils/runtime'

/** Four numbers and their names. */
const BODY_MAXIMUM_LENGTH = 256

/**
 * POST /api/window-place (local mode only): where the desktop app's window is now, as the page reports it, kept so that
 * the launcher opens the next window there.
 */
export default defineEventHandler(async (event) => {
  requireMode(event, 'local')
  requireSameOrigin(event)
  const place = readWindowPlace(await readJsonRecord(event, BODY_MAXIMUM_LENGTH))
  if (!place) throw apiError(400, 'Could not read that.')
  await writeWindowPlace(place)
  return { ok: true }
})

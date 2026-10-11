import { writeSavedState } from '../utils/local-saves'
import { readJsonRecord, requireSameOrigin } from '../utils/request'
import { requireMode } from '../utils/runtime'

/** Years of session history fit in a fraction of this. */
const BODY_MAXIMUM_LENGTH = 5_000_000

/** PUT /api/state (local mode only): replaces the saved state. */
export default defineEventHandler(async (event) => {
  requireMode(event, 'local')
  requireSameOrigin(event)
  await writeSavedState(await readJsonRecord(event, BODY_MAXIMUM_LENGTH))
  return { ok: true }
})

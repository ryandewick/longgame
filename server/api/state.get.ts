import { readSavedState } from '../utils/local-saves'
import { requireMode } from '../utils/runtime'

/** GET /api/state (local mode only): the saved state, or `{}` when nothing has been saved. */
export default defineEventHandler((event) => {
  requireMode(event, 'local')
  return readSavedState()
})

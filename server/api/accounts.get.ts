import { readStoredAccounts } from '../utils/local-saves'
import { requireMode } from '../utils/runtime'

/** GET /api/accounts (local mode only): every saved account, or `{}` when none have been saved. */
export default defineEventHandler((event) => {
  requireMode(event, 'local')
  return readStoredAccounts()
})

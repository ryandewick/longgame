import { writeStoredAccounts } from '../utils/local-saves'
import { readJsonRecord, requireSameOrigin } from '../utils/request'
import { requireMode } from '../utils/runtime'

/** Several accounts with years of session history each fit in a fraction of this. */
const BODY_MAXIMUM_LENGTH = 20_000_000

/** PUT /api/accounts (local mode only): replaces the saved accounts. */
export default defineEventHandler(async (event) => {
  requireMode(event, 'local')
  requireSameOrigin(event)
  await writeStoredAccounts(await readJsonRecord(event, BODY_MAXIMUM_LENGTH))
  return { ok: true }
})

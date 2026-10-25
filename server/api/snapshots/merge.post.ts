import { valueOrThrow } from '../../utils/errors'
import { readSnapshots, writeSnapshots } from '../../utils/local-saves'
import { readJsonRecord, requireSameOrigin } from '../../utils/request'
import { requireMode } from '../../utils/runtime'
import { mergeSnapshots, parseSnapshotMerge } from '../../utils/snapshots'

/** The most snapshots kept for a player, at well under a kilobyte each, fit in this. */
const BODY_MAXIMUM_LENGTH = 5_000_000

/**
 * POST /api/snapshots/merge (local mode only): merges a history into a player's, when an account changes its name or
 * an account is imported. It only ever adds to what is kept.
 */
export default defineEventHandler(async (event) => {
  requireMode(event, 'local')
  requireSameOrigin(event)
  const body = await readJsonRecord(event, BODY_MAXIMUM_LENGTH)
  const { name, snapshots } = valueOrThrow(parseSnapshotMerge(body))
  const kept = mergeSnapshots(await readSnapshots(name), snapshots)
  await writeSnapshots(name, kept)
  return { ok: true, count: kept.length }
})

import { valueOrThrow } from '../utils/errors'
import { readSnapshots, writeSnapshots } from '../utils/local-saves'
import { readJsonRecord, requireSameOrigin } from '../utils/request'
import { requireMode } from '../utils/runtime'
import { appendSnapshot, parseSnapshotReading } from '../utils/snapshots'

const BODY_MAXIMUM_LENGTH = 16_384

/** POST /api/snapshots (local mode only): records a player's XP after a hiscores refresh. */
export default defineEventHandler(async (event) => {
  requireMode(event, 'local')
  requireSameOrigin(event)
  const body = await readJsonRecord(event, BODY_MAXIMUM_LENGTH)
  const { name, skills, totalXp } = valueOrThrow(parseSnapshotReading(body))

  const { snapshots, unchanged } = appendSnapshot(await readSnapshots(name), {
    takenAt: Date.now(),
    skills,
    totalXp,
  })
  await writeSnapshots(name, snapshots)
  return { ok: true, unchanged, count: snapshots.length }
})

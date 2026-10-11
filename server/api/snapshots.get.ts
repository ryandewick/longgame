import { valueOrThrow } from '../utils/errors'
import { readSnapshots } from '../utils/local-saves'
import { parsePlayerName } from '../utils/player-name'
import { requireMode } from '../utils/runtime'

/** GET /api/snapshots?name= (local mode only): a player's XP history, oldest first. */
export default defineEventHandler((event) => {
  requireMode(event, 'local')
  const name = valueOrThrow(parsePlayerName(getQuery(event).name))
  return readSnapshots(name)
})

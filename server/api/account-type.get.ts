import { valueOrThrow } from '../utils/errors'
import { lookUpAccountType } from '../utils/jagex'
import { parsePlayerName } from '../utils/player-name'
import { upstreamClient } from '../utils/runtime'

/** GET /api/account-type?name=: whether a player is a main or an ironman. */
export default defineEventHandler(async (event) => {
  const name = valueOrThrow(parsePlayerName(getQuery(event).name))
  const type = valueOrThrow(await lookUpAccountType(name, upstreamClient(event)))
  return { type }
})

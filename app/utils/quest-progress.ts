import type { QuestProgress } from '#shared/types/quest-progress'

const isNameList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((name) => typeof name === 'string')

/**
 * Checks what /api/quest-progress answered. Null when it is not a report of quest progress, in
 * which case the account's ticks are left as they are. The started quests may be left out; when
 * they are sent, they must be a list of names like the rest.
 */
export function parseQuestProgress(payload: unknown): QuestProgress | null {
  if (typeof payload !== 'object' || payload === null) return null
  if (!('quests' in payload) || !isNameList(payload.quests)) return null
  if (!('diaries' in payload) || !isNameList(payload.diaries)) return null
  if (!('fetched' in payload) || typeof payload.fetched !== 'number') return null
  const report = { quests: payload.quests, diaries: payload.diaries, fetched: payload.fetched }
  if (!('started' in payload)) return report
  return isNameList(payload.started) ? { ...report, started: payload.started } : null
}

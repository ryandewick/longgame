import { describe, expect, it } from 'vitest'
import { parseQuestProgress } from '~~/app/utils/quest-progress'

describe('parseQuestProgress', () => {
  it('reads a report of completed quests and diaries', () => {
    const report = {
      quests: ["Cook's Assistant", 'Dragon Slayer I'],
      diaries: ['Ardougne Medium', 'Kourend & Kebos Easy'],
      fetched: 1_700_000_000_000,
    }
    expect(parseQuestProgress(report)).toEqual(report)
  })

  it('reads a report with nothing completed', () => {
    expect(parseQuestProgress({ quests: [], diaries: [], fetched: 1 })).toEqual({
      quests: [],
      diaries: [],
      fetched: 1,
    })
  })

  it('reads the quests started, when the provider sends them', () => {
    const report = { quests: [], started: ['Fairytale II - Cure a Queen'], diaries: [], fetched: 1 }
    expect(parseQuestProgress(report)).toEqual(report)
  })

  it('leaves out anything else the provider sent along', () => {
    const report = { quests: [], diaries: [], fetched: 1, league: 'none' }
    expect(parseQuestProgress(report)).toEqual({ quests: [], diaries: [], fetched: 1 })
  })

  it.each([
    null,
    undefined,
    'text',
    [],
    {},
    { quests: [], diaries: [] },
    { quests: [], fetched: 1 },
    { quests: 'all', diaries: [], fetched: 1 },
    { quests: ["Cook's Assistant", 2], diaries: [], fetched: 1 },
    { quests: [], diaries: [{ region: 'Ardougne' }], fetched: 1 },
    { quests: [], diaries: [], fetched: 'now' },
    { quests: [], started: 'Fairytale II', diaries: [], fetched: 1 },
    { quests: [], started: [1], diaries: [], fetched: 1 },
  ])('refuses %j', (payload) => {
    expect(parseQuestProgress(payload)).toBeNull()
  })
})

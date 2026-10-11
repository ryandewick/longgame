import { describe, expect, it } from 'vitest'
import { RESETS } from '#shared/data/resets'
import { resetsTableRows, type ResetsTableRow } from '~~/app/utils/reset-rows'
import { accountWith } from '../domain/helpers'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** 10 October 2026, 20:00 UTC. */
const NOW = Date.UTC(2026, 9, 10, 20)

const veteran = accountWith({ everySkill: 99, allQuests: true, allDiaries: true })

const rowFor = (rows: readonly ResetsTableRow[], key: string): ResetsTableRow | undefined =>
  rows.find((row) => row.key === key)

describe('resetsTableRows', () => {
  it('lists every reset open to the account type, in the order the data has them', () => {
    const forMain = RESETS.filter((reset) => reset.audience !== 'iron').map((reset) => reset.key)
    expect(resetsTableRows(veteran, {}, NOW).map((row) => row.key)).toEqual(forMain)

    const ironman = accountWith({ type: 'iron', everySkill: 99, allQuests: true })
    const forIronman = RESETS.filter((reset) => reset.audience !== 'main').map((reset) => reset.key)
    expect(resetsTableRows(ironman, {}, NOW).map((row) => row.key)).toEqual(forIronman)
  })

  it('carries the name and the skill of each reset, and how often it comes round', () => {
    expect(rowFor(resetsTableRows(veteran, {}, NOW), 'birdhouse')).toMatchObject({
      name: 'Birdhouse run',
      skill: 'hunter',
      every: '50 min',
      needs: null,
    })
  })

  it('keeps a locked reset in the list and says what it needs, quests before levels', () => {
    const rows = resetsTableRows(accountWith(), {}, NOW)
    expect(rows).toHaveLength(resetsTableRows(veteran, {}, NOW).length)
    expect(rowFor(rows, 'birdhouse')?.needs).toBe('Bone Voyage, 5 Hunter')
    expect(rowFor(rows, 'herb')?.needs).toBe('9 Farming')
  })

  it('says a reset never done is due, never done', () => {
    expect(rowFor(resetsTableRows(veteran, {}, NOW), 'herb')).toMatchObject({
      isDue: true,
      status: 'never done',
    })
  })

  it('says when a reset that has come round was last done', () => {
    const rows = resetsTableRows(veteran, { herb: NOW - 3 * HOUR, birdhouse: NOW - 8 * DAY }, NOW)
    expect(rowFor(rows, 'herb')).toMatchObject({ isDue: true, status: 'last 3 h ago' })
    expect(rowFor(rows, 'birdhouse')).toMatchObject({ isDue: true, status: 'last 8 d ago' })
  })

  it('says how long until a reset that is not due comes round', () => {
    const rows = resetsTableRows(veteran, { herb: NOW - 30 * MINUTE }, NOW)
    expect(rowFor(rows, 'herb')).toMatchObject({ isDue: false, status: 'ready in 50 min' })
  })

  it('reads a reset logged after the clock last moved as done this instant', () => {
    // the clock on screen is 20 seconds behind the click that logged the run: counted from the
    // screen's time, a run that comes round every 50 minutes would be 51 away
    const rows = resetsTableRows(veteran, { birdhouse: NOW + 20_000 }, NOW)
    expect(rowFor(rows, 'birdhouse')).toMatchObject({ isDue: false, status: 'ready in 50 min' })
  })

  it('words how often each kind of reset comes round', () => {
    const everyTexts = new Set(resetsTableRows(veteran, {}, NOW).map((row) => row.every))
    expect(everyTexts).toContain('Daily, 00:00 UTC')
    expect(everyTexts).toContain('Every 7 days')
    expect(everyTexts).toContain('80 min')
  })
})

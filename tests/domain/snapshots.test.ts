import { describe, expect, it } from 'vitest'
import type { XpSnapshot } from '#shared/types/snapshot'
import { appendSnapshot, mergeSnapshots, parseSnapshots } from '#shared/domain/snapshots'

const DAY = 86_400_000

/** A snapshot taken on day `day` with `miningXp` in Mining. */
function snapshot(day: number, miningXp: number): XpSnapshot {
  return { takenAt: day * DAY, skills: { mining: miningXp, fishing: 500 }, totalXp: miningXp + 500 }
}

describe('appendSnapshot', () => {
  it('starts a history', () => {
    expect(appendSnapshot([], snapshot(1, 100), 600)).toEqual({
      snapshots: [snapshot(1, 100)],
      unchanged: false,
    })
  })

  it('adds a snapshot when XP has changed', () => {
    const history = [snapshot(1, 100), snapshot(2, 100)]
    expect(appendSnapshot(history, snapshot(3, 250), 600)).toEqual({
      snapshots: [...history, snapshot(3, 250)],
      unchanged: false,
    })
  })

  it('adds a second identical snapshot, so a quiet stretch has a start and an end', () => {
    const history = [snapshot(1, 50), snapshot(2, 100)]
    expect(appendSnapshot(history, snapshot(3, 100), 600).snapshots).toEqual([
      ...history,
      snapshot(3, 100),
    ])
  })

  it('slides the last snapshot forward when the last two already show the same XP', () => {
    const history = [snapshot(1, 50), snapshot(2, 100), snapshot(3, 100)]
    const { snapshots, unchanged } = appendSnapshot(history, snapshot(9, 100), 600)
    expect(unchanged).toBe(true)
    // the gain to 100 XP stays on day 2, where it was first seen
    expect(snapshots).toEqual([snapshot(1, 50), snapshot(2, 100), snapshot(9, 100)])
  })

  it('treats a skill that appears as a change', () => {
    const history = [snapshot(1, 100), snapshot(2, 100)]
    const withSailing: XpSnapshot = {
      takenAt: 3 * DAY,
      skills: { mining: 100, fishing: 500, sailing: 0 },
      totalXp: 600,
    }
    expect(appendSnapshot(history, withSailing, 600).unchanged).toBe(false)
  })

  it('keeps only the newest snapshots up to the limit', () => {
    const history = [snapshot(1, 10), snapshot(2, 20), snapshot(3, 30)]
    expect(appendSnapshot(history, snapshot(4, 40), 3).snapshots).toEqual([
      snapshot(2, 20),
      snapshot(3, 30),
      snapshot(4, 40),
    ])
  })

  it('does not change the history it was given', () => {
    const history = [snapshot(1, 100), snapshot(2, 100)]
    const copy = structuredClone(history)
    appendSnapshot(history, snapshot(3, 100), 600)
    appendSnapshot(history, snapshot(3, 200), 600)
    expect(history).toEqual(copy)
  })
})

describe('mergeSnapshots', () => {
  it('keeps every snapshot of both histories, oldest first', () => {
    const kept = [snapshot(1, 100), snapshot(4, 400)]
    const other = [snapshot(2, 200), snapshot(3, 300), snapshot(5, 500)]
    expect(mergeSnapshots(kept, other, 600)).toEqual([
      snapshot(1, 100),
      snapshot(2, 200),
      snapshot(3, 300),
      snapshot(4, 400),
      snapshot(5, 500),
    ])
  })

  it('keeps a moment both hold once, as the first history has it', () => {
    const kept = [snapshot(1, 100), snapshot(2, 200)]
    const other = [{ ...snapshot(2, 999) }, snapshot(3, 300)]
    expect(mergeSnapshots(kept, other, 600)).toEqual([
      snapshot(1, 100),
      snapshot(2, 200),
      snapshot(3, 300),
    ])
  })

  it('keeps a history whole when the other is empty, from either side', () => {
    const history = [snapshot(1, 100), snapshot(2, 200)]
    expect(mergeSnapshots(history, [], 600)).toEqual(history)
    expect(mergeSnapshots([], history, 600)).toEqual(history)
  })

  it('keeps only the newest snapshots up to the limit', () => {
    const merged = mergeSnapshots([snapshot(1, 10), snapshot(3, 30)], [snapshot(2, 20)], 2)
    expect(merged).toEqual([snapshot(2, 20), snapshot(3, 30)])
  })

  it('does not change either history it was given', () => {
    const kept = [snapshot(3, 300)]
    const other = [snapshot(1, 100)]
    mergeSnapshots(kept, other, 600)
    expect(kept).toEqual([snapshot(3, 300)])
    expect(other).toEqual([snapshot(1, 100)])
  })
})

describe('parseSnapshots', () => {
  it('returns the snapshots in a stored history, in order', () => {
    const stored = [snapshot(1, 100), snapshot(2, 200)]
    expect(parseSnapshots(stored)).toEqual(stored)
  })

  it.each([null, undefined, 'text', { takenAt: 1 }])('reads %j as an empty history', (stored) => {
    expect(parseSnapshots(stored)).toEqual([])
  })

  it('skips entries that are not snapshots', () => {
    const stored = [
      snapshot(1, 100),
      null,
      { takenAt: 'yesterday', skills: { mining: 1 }, totalXp: 1 },
      { takenAt: 3, skills: { mining: 1 } },
      { takenAt: 3, skills: [1], totalXp: 1 },
      snapshot(4, 400),
    ]
    expect(parseSnapshots(stored)).toEqual([snapshot(1, 100), snapshot(4, 400)])
  })

  it('drops the XP of a skill this app does not know, and XP that is not a number', () => {
    const stored = [
      { takenAt: DAY, skills: { mining: 100, dungeoneering: 50, fishing: 'lots' }, totalXp: 150 },
    ]
    expect(parseSnapshots(stored)).toEqual([
      { takenAt: DAY, skills: { mining: 100 }, totalXp: 150 },
    ])
  })
})

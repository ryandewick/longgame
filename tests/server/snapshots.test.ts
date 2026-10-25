import { describe, expect, it } from 'vitest'
import {
  appendSnapshot,
  legacySnapshotStorageKey,
  mergeSnapshots,
  parseLegacySnapshots,
  parseSnapshotMerge,
  parseSnapshotReading,
  parseStoredSnapshots,
  SNAPSHOT_LIMIT,
  snapshotStorageKey,
  type Snapshot,
} from '~~/server/utils/snapshots'

const DAY = 86_400_000

/** A snapshot taken on day `day` with `miningXp` in Mining. */
function snapshot(day: number, miningXp: number): Snapshot {
  return { takenAt: day * DAY, skills: { mining: miningXp, fishing: 500 }, totalXp: miningXp + 500 }
}

describe('appendSnapshot', () => {
  it('starts a history', () => {
    expect(appendSnapshot([], snapshot(1, 100))).toEqual({
      snapshots: [snapshot(1, 100)],
      unchanged: false,
    })
  })

  it('adds a snapshot when XP has changed', () => {
    const history = [snapshot(1, 100), snapshot(2, 100)]
    expect(appendSnapshot(history, snapshot(3, 250))).toEqual({
      snapshots: [...history, snapshot(3, 250)],
      unchanged: false,
    })
  })

  it('adds a second identical snapshot, so a quiet stretch has a start and an end', () => {
    const history = [snapshot(1, 50), snapshot(2, 100)]
    expect(appendSnapshot(history, snapshot(3, 100))).toEqual({
      snapshots: [...history, snapshot(3, 100)],
      unchanged: false,
    })
  })

  it('slides the last snapshot forward when the last two already show the same XP', () => {
    const history = [snapshot(1, 50), snapshot(2, 100), snapshot(3, 100)]
    const { snapshots, unchanged } = appendSnapshot(history, snapshot(9, 100))
    expect(unchanged).toBe(true)
    // the gain to 100 XP stays on day 2, where it was first seen
    expect(snapshots).toEqual([snapshot(1, 50), snapshot(2, 100), snapshot(9, 100)])
  })

  it('compares skills by value, whatever order the keys arrive in', () => {
    const history = [snapshot(1, 100), snapshot(2, 100)]
    const reordered: Snapshot = {
      takenAt: 3 * DAY,
      skills: { fishing: 500, mining: 100 },
      totalXp: 600,
    }
    expect(appendSnapshot(history, reordered).unchanged).toBe(true)
  })

  it('treats a skill that appears or disappears as a change', () => {
    const history = [snapshot(1, 100), snapshot(2, 100)]
    const withSailing: Snapshot = {
      takenAt: 3 * DAY,
      skills: { mining: 100, fishing: 500, sailing: 0 },
      totalXp: 600,
    }
    const withoutFishing: Snapshot = { takenAt: 3 * DAY, skills: { mining: 100 }, totalXp: 100 }
    expect(appendSnapshot(history, withSailing).unchanged).toBe(false)
    expect(appendSnapshot(history, withoutFishing).unchanged).toBe(false)
  })

  it('does not change the history it was given', () => {
    const history = [snapshot(1, 100), snapshot(2, 100)]
    const copy = structuredClone(history)
    appendSnapshot(history, snapshot(3, 100))
    appendSnapshot(history, snapshot(3, 200))
    expect(history).toEqual(copy)
  })

  it('drops the oldest snapshots beyond the limit', () => {
    const history = [snapshot(1, 10), snapshot(2, 20), snapshot(3, 30)]
    expect(appendSnapshot(history, snapshot(4, 40), 3).snapshots).toEqual([
      snapshot(2, 20),
      snapshot(3, 30),
      snapshot(4, 40),
    ])
  })

  it('keeps 5000 snapshots unless told otherwise', () => {
    const history = Array.from({ length: SNAPSHOT_LIMIT }, (_unused, index) =>
      snapshot(index, index),
    )
    const { snapshots } = appendSnapshot(history, snapshot(SNAPSHOT_LIMIT, SNAPSHOT_LIMIT))
    expect(SNAPSHOT_LIMIT).toBe(5000)
    expect(snapshots).toHaveLength(5000)
    expect(snapshots.at(0)).toEqual(snapshot(1, 1))
    expect(snapshots.at(-1)).toEqual(snapshot(SNAPSHOT_LIMIT, SNAPSHOT_LIMIT))
  })
})

describe('parseSnapshotReading', () => {
  const reading = { name: ' Zezima ', skills: { mining: 100, fishing: 0 }, totalXp: 100 }

  it('accepts a reading and trims the name', () => {
    expect(parseSnapshotReading(reading)).toEqual({
      ok: true,
      value: { name: 'Zezima', skills: { mining: 100, fishing: 0 }, totalXp: 100 },
    })
  })

  it('refuses a name that is not a RuneScape name', () => {
    expect(parseSnapshotReading({ ...reading, name: '../state' })).toEqual({
      ok: false,
      failure: { statusCode: 400, message: 'That does not look like a RuneScape name.' },
    })
  })

  it.each([
    ['no skills', { skills: undefined }],
    ['an empty skills object', { skills: {} }],
    ['skills as a list', { skills: [100] }],
    ['XP as text', { skills: { mining: '100' } }],
    ['negative XP', { skills: { mining: -1 } }],
    ['a skill key that is not a word', { skills: { '../mining': 1 } }],
    ['no total', { totalXp: undefined }],
    ['a total that is not a number', { totalXp: Number.NaN }],
    ['far too many skills', { skills: Object.fromEntries(manySkills(65)) }],
  ])('refuses %s', (_reason, changes) => {
    expect(parseSnapshotReading({ ...reading, ...changes })).toEqual({
      ok: false,
      failure: { statusCode: 400, message: 'Could not read that.' },
    })
  })
})

/** `count` different skill keys made only of letters, each with 1 XP. */
function manySkills(count: number): Array<[string, number]> {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  return Array.from({ length: count }, (_unused, index) => [
    `skill${letters.charAt(index % 26)}${letters.charAt(Math.floor(index / 26))}`,
    1,
  ])
}

describe('parseSnapshotMerge', () => {
  const merge = { name: ' Zezima ', snapshots: [snapshot(1, 100), snapshot(2, 200)] }

  it('accepts a history and trims the name', () => {
    expect(parseSnapshotMerge(merge)).toEqual({
      ok: true,
      value: { name: 'Zezima', snapshots: [snapshot(1, 100), snapshot(2, 200)] },
    })
  })

  it('leaves out an entry that is not a snapshot, as a history read from disk does', () => {
    const body = { ...merge, snapshots: [snapshot(1, 100), { takenAt: 'yesterday' }, null] }
    expect(parseSnapshotMerge(body)).toEqual({
      ok: true,
      value: { name: 'Zezima', snapshots: [snapshot(1, 100)] },
    })
  })

  it('refuses a name that is not a RuneScape name', () => {
    expect(parseSnapshotMerge({ ...merge, name: '../state' })).toEqual({
      ok: false,
      failure: { statusCode: 400, message: 'That does not look like a RuneScape name.' },
    })
  })

  it.each([
    ['no history', { snapshots: undefined }],
    ['a history that is not a list', { snapshots: { 0: snapshot(1, 100) } }],
  ])('refuses %s', (_reason, changes) => {
    expect(parseSnapshotMerge({ ...merge, ...changes })).toEqual({
      ok: false,
      failure: { statusCode: 400, message: 'Could not read that.' },
    })
  })
})

describe('mergeSnapshots', () => {
  it('keeps every snapshot of both, oldest first, and the stored one where both hold a moment', () => {
    const stored = [snapshot(1, 100), snapshot(3, 300)]
    const incoming = [snapshot(2, 200), snapshot(3, 999)]
    expect(mergeSnapshots(stored, incoming)).toEqual([
      snapshot(1, 100),
      snapshot(2, 200),
      snapshot(3, 300),
    ])
  })

  it(`keeps ${SNAPSHOT_LIMIT} snapshots unless told otherwise, dropping the oldest`, () => {
    const stored = Array.from({ length: SNAPSHOT_LIMIT }, (_unused, day) => snapshot(day, day))
    const merged = mergeSnapshots(stored, [snapshot(SNAPSHOT_LIMIT, 1)])
    expect(merged).toHaveLength(SNAPSHOT_LIMIT)
    expect(merged.at(0)).toEqual(snapshot(1, 1))
    expect(merged.at(-1)).toEqual(snapshot(SNAPSHOT_LIMIT, 1))
  })
})

describe('parseStoredSnapshots', () => {
  it('returns the snapshots in a stored history', () => {
    const stored = [snapshot(1, 100), snapshot(2, 200)]
    expect(parseStoredSnapshots(stored)).toEqual(stored)
  })

  it.each([null, undefined, 'text', { takenAt: 1 }])('reads %j as an empty history', (stored) => {
    expect(parseStoredSnapshots(stored)).toEqual([])
  })

  it('skips entries that are not snapshots', () => {
    const stored = [
      snapshot(1, 100),
      null,
      { takenAt: 'yesterday', skills: { mining: 1 }, totalXp: 1 },
      { takenAt: 2, skills: { mining: 'lots' }, totalXp: 1 },
      { takenAt: 3, skills: { mining: 1 } },
      snapshot(4, 400),
    ]
    expect(parseStoredSnapshots(stored)).toEqual([snapshot(1, 100), snapshot(4, 400)])
  })
})

describe('snapshotStorageKey', () => {
  it('is lower case with underscores for spaces', () => {
    expect(snapshotStorageKey('Iron Man 99')).toBe('snapshots:iron_man_99.json')
  })

  it('gives the same key for a name typed with a space or an underscore', () => {
    expect(snapshotStorageKey('Lynx Titan')).toBe(snapshotStorageKey('lynx_titan'))
  })
})

describe('legacySnapshotStorageKey', () => {
  it("is the old app's file name: lower case, with underscores for spaces", () => {
    expect(legacySnapshotStorageKey('Iron Man 99')).toBe('snapshots_iron_man_99.json')
    expect(legacySnapshotStorageKey(' Zezima ')).toBe('snapshots_zezima.json')
  })

  it('keeps hyphens and underscores, as the old server did', () => {
    expect(legacySnapshotStorageKey('Mod-Ash_2')).toBe('snapshots_mod-ash_2.json')
  })

  it('drops anything else, and falls back to "player" when nothing is left', () => {
    expect(legacySnapshotStorageKey('a.b/c')).toBe('snapshots_abc.json')
    expect(legacySnapshotStorageKey('...')).toBe('snapshots_player.json')
  })
})

describe('parseLegacySnapshots', () => {
  it("reads the old app's snapshots into this app's shape, in the same order", () => {
    const stored = [
      { t: 1 * DAY, skills: { mining: 100, fishing: 500 }, total: 600 },
      { t: 2 * DAY, skills: { mining: 250, fishing: 500 }, total: 750 },
    ]
    expect(parseLegacySnapshots(stored)).toEqual([snapshot(1, 100), snapshot(2, 250)])
  })

  it('reads a snapshot with no total as a total of 0', () => {
    expect(parseLegacySnapshots([{ t: 5, skills: { mining: 1 } }])).toEqual([
      { takenAt: 5, skills: { mining: 1 }, totalXp: 0 },
    ])
  })

  it.each([null, undefined, 'text', { t: 1 }])('reads %j as an empty history', (stored) => {
    expect(parseLegacySnapshots(stored)).toEqual([])
  })

  it('skips entries that are not snapshots', () => {
    const stored = [
      { t: 1, skills: { mining: 1 }, total: 1 },
      null,
      { t: 'yesterday', skills: { mining: 1 }, total: 1 },
      { t: 2, skills: { mining: 'lots' }, total: 1 },
      { t: 3, skills: {}, total: 1 },
      // this app's own shape is not the old one
      { takenAt: 4, skills: { mining: 1 }, totalXp: 1 },
    ]
    expect(parseLegacySnapshots(stored)).toEqual([
      { takenAt: 1, skills: { mining: 1 }, totalXp: 1 },
    ])
  })
})

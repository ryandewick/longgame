import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { XpSnapshot } from '#shared/types/snapshot'
import {
  blankSave,
  migrateLegacySave,
  migrateLegacySnapshots,
  type LegacySaveV1,
  type LegacySnapshot,
  type SavedState,
} from '#shared/domain/save'
import {
  accountFileName,
  buildExportFile,
  EXPORT_FILE_VERSION,
  readExportFile,
} from '~~/app/utils/export-file'

const DAY = 86_400_000

const namedSave = (name: string): SavedState => ({ ...blankSave(), name })

const snapshots: XpSnapshot[] = [
  { takenAt: DAY, skills: { mining: 100 }, totalXp: 100 },
  { takenAt: 2 * DAY, skills: { mining: 300 }, totalXp: 300 },
]

/** The fixture account: a version 1 save and its snapshots, as the first version of the app kept them. */
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { state: LegacySaveV1; snapshots: LegacySnapshot[] }

describe('buildExportFile', () => {
  it('marks the file as this app’s and carries the save and the history as they are', () => {
    const save = namedSave('Zezima')
    expect(buildExportFile(save, snapshots)).toEqual({
      longgame: EXPORT_FILE_VERSION,
      save,
      snapshots,
    })
  })
})

describe('accountFileName', () => {
  it('names the file after the account', () => {
    expect(accountFileName('Zezima', 'json')).toBe('longgame-Zezima.json')
    expect(accountFileName('Iron-Man_99', 'png')).toBe('longgame-Iron-Man_99.png')
  })

  it('replaces each run of anything else with one underscore', () => {
    expect(accountFileName('Lynx Titan', 'json')).toBe('longgame-Lynx_Titan.json')
    expect(accountFileName('a  /\\  b', 'png')).toBe('longgame-a_b.png')
  })
})

describe('readExportFile', () => {
  it('reads back what Export wrote', () => {
    const save = namedSave('Zezima')
    const text = JSON.stringify(buildExportFile(save, snapshots))
    expect(readExportFile(text)).toEqual({ save, snapshots })
  })

  it('reads the whole of a real account back out of its own export', () => {
    const save = migrateLegacySave(fixture.state)
    const history = migrateLegacySnapshots(fixture.snapshots)
    const read = readExportFile(JSON.stringify(buildExportFile(save, history)))
    expect(read).toEqual({ save, snapshots: history })
  })

  it('reads a file the vanilla app exported, migrating the save and the snapshots', () => {
    const text = JSON.stringify({ longgame: 1, state: fixture.state, snaps: fixture.snapshots })
    const read = readExportFile(text)
    expect(read?.save).toEqual(migrateLegacySave(fixture.state))
    expect(read?.save.version).toBe(2)
    expect(read?.snapshots).toEqual(migrateLegacySnapshots(fixture.snapshots))
    expect(read?.snapshots.length).toBeGreaterThan(0)
  })

  it('skips whatever in the history is not a snapshot', () => {
    const current = JSON.stringify({
      longgame: 2,
      save: namedSave('Zezima'),
      snapshots: [snapshots[0], 'not a snapshot', { takenAt: 'yesterday' }, snapshots[1]],
    })
    expect(readExportFile(current)?.snapshots).toEqual(snapshots)

    const legacy = JSON.stringify({
      longgame: 1,
      state: { v: 1, name: 'Old Timer', prefs: {} },
      snaps: [{ t: DAY, skills: { mining: 100, dungeoneering: 5 }, total: 100 }, null, 7],
    })
    expect(readExportFile(legacy)?.snapshots).toEqual([snapshots[0]])
  })

  it('gives an empty history to a file that has none', () => {
    const current = JSON.stringify({ longgame: 2, save: namedSave('Zezima') })
    expect(readExportFile(current)?.snapshots).toEqual([])
    const legacy = JSON.stringify({ state: { v: 1, name: 'Old Timer', prefs: {} }, snaps: 'none' })
    expect(readExportFile(legacy)?.snapshots).toEqual([])
  })

  it('fills in what a save trimmed by hand lacks from the blank save', () => {
    const trimmed = {
      version: 2,
      name: 'Zezima',
      preferences: { mood: 'afk' },
      completedQuests: ['Bone Voyage'],
    }
    const read = readExportFile(JSON.stringify({ longgame: 2, save: trimmed, snapshots: [] }))
    expect(read?.save).toEqual({
      ...blankSave(),
      name: 'Zezima',
      completedQuests: ['Bone Voyage'],
      preferences: { ...blankSave().preferences, mood: 'afk' },
    })
  })

  it('refuses text that is not JSON, or JSON that is not a file of ours', () => {
    expect(readExportFile('')).toBeNull()
    expect(readExportFile('{"longgame":2,"save":{"version":2,"name":"Cut sh')).toBeNull()
    expect(readExportFile('null')).toBeNull()
    expect(readExportFile('[]')).toBeNull()
    expect(readExportFile('"longgame"')).toBeNull()
    expect(readExportFile('{}')).toBeNull()
    expect(readExportFile(JSON.stringify({ longgame: 2, snapshots }))).toBeNull()
  })

  it('refuses a save of a version it does not know', () => {
    const future = { ...namedSave('Zezima'), version: 99 }
    expect(readExportFile(JSON.stringify({ longgame: 99, save: future }))).toBeNull()
    expect(
      readExportFile(JSON.stringify({ state: { v: 2, name: 'Zezima', prefs: {} } })),
    ).toBeNull()
  })

  it('refuses a save with no name or no preferences, as the vanilla app did', () => {
    const { name: _name, ...nameless } = namedSave('Zezima')
    expect(readExportFile(JSON.stringify({ longgame: 2, save: nameless }))).toBeNull()
    expect(readExportFile(JSON.stringify({ longgame: 2, save: namedSave('') }))).toBeNull()
    const { preferences: _preferences, ...bare } = namedSave('Zezima')
    expect(readExportFile(JSON.stringify({ longgame: 2, save: bare }))).toBeNull()

    expect(readExportFile(JSON.stringify({ state: { v: 1, prefs: {} } }))).toBeNull()
    expect(readExportFile(JSON.stringify({ state: { v: 1, name: 'Old Timer' } }))).toBeNull()
    expect(readExportFile(JSON.stringify({ state: { v: 1, name: 7, prefs: {} } }))).toBeNull()
  })
})

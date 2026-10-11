import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readSavedState,
  readSnapshots,
  writeSavedState,
  writeSnapshots,
} from '~~/server/utils/local-saves'

/** One of Nitro's storage mounts, kept in memory. `writes` counts what was written to it. */
function memoryMount(files: Record<string, unknown> = {}) {
  const items = new Map(Object.entries(files))
  const mount = {
    writes: 0,
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: unknown) => {
      mount.writes += 1
      items.set(key, value)
    },
  }
  return mount
}

/** Stands in for Nitro's `useStorage`, which local-saves.ts gets as an auto-import. */
function mountStorage(mounts: {
  data: ReturnType<typeof memoryMount>
  'legacy-saves': ReturnType<typeof memoryMount>
}): void {
  vi.stubGlobal('useStorage', (name: 'data' | 'legacy-saves') => mounts[name])
}

const LEGACY_STATE = { v: 1, name: 'Old Timer', prefs: { mood: 'afk' } }
const LEGACY_HISTORY = [
  { t: 1000, skills: { mining: 50 }, total: 50 },
  { t: 2000, skills: { mining: 80 }, total: 80 },
]
const MIGRATED_HISTORY = [
  { takenAt: 1000, skills: { mining: 50 }, totalXp: 50 },
  { takenAt: 2000, skills: { mining: 80 }, totalXp: 80 },
]

describe('the saved state', () => {
  let data: ReturnType<typeof memoryMount>
  let legacy: ReturnType<typeof memoryMount>

  beforeEach(() => {
    data = memoryMount()
    legacy = memoryMount({ 'state.json': LEGACY_STATE })
    mountStorage({ data, 'legacy-saves': legacy })
  })

  it('is empty for a player who has never saved anything', async () => {
    mountStorage({ data, 'legacy-saves': memoryMount() })
    expect(await readSavedState()).toEqual({})
  })

  it("is the old app's save, as it is, while this app has none of its own", async () => {
    expect(await readSavedState()).toEqual(LEGACY_STATE)
  })

  it("is this app's own save once one has been written, and the old file is left alone", async () => {
    const current = { version: 2, name: 'Old Timer' }
    await writeSavedState(current)
    expect(await readSavedState()).toEqual(current)
    expect(await legacy.getItem('state.json')).toEqual(LEGACY_STATE)
    expect(legacy.writes).toBe(0)
  })

  it('ignores an old file that is not a JSON object', async () => {
    mountStorage({ data, 'legacy-saves': memoryMount({ 'state.json': 'cut short {' }) })
    expect(await readSavedState()).toEqual({})
  })
})

describe("a player's XP history", () => {
  let data: ReturnType<typeof memoryMount>
  let legacy: ReturnType<typeof memoryMount>

  beforeEach(() => {
    data = memoryMount()
    legacy = memoryMount({ 'snapshots_old_timer.json': LEGACY_HISTORY })
    mountStorage({ data, 'legacy-saves': legacy })
  })

  it('is empty when neither app has one', async () => {
    expect(await readSnapshots('Somebody Else')).toEqual([])
  })

  it("is the old app's history, in this app's shape, while this app has none of its own", async () => {
    expect(await readSnapshots('Old Timer')).toEqual(MIGRATED_HISTORY)
  })

  it("is this app's own history once one has been written, and the old file is left alone", async () => {
    const extended = [...MIGRATED_HISTORY, { takenAt: 3000, skills: { mining: 90 }, totalXp: 90 }]
    await writeSnapshots('Old Timer', extended)
    expect(await readSnapshots('Old Timer')).toEqual(extended)
    expect(await data.getItem('snapshots:old_timer.json')).toEqual(extended)
    expect(await legacy.getItem('snapshots_old_timer.json')).toEqual(LEGACY_HISTORY)
    expect(legacy.writes).toBe(0)
  })

  it("does not fall back to the old history once this app's own exists, even empty", async () => {
    await writeSnapshots('Old Timer', [])
    expect(await readSnapshots('Old Timer')).toEqual([])
  })
})

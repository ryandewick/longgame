import { describe, expect, it } from 'vitest'
import type { XpSnapshot } from '#shared/types/snapshot'
import { forEverySkill } from '#shared/data/skills'
import { blankSave, type LegacySaveV1, type SavedState } from '#shared/domain/save'
import type { XpReading } from '~~/app/utils/hiscores'
import {
  BROWSER_SNAPSHOT_LIMIT,
  createBrowserSaveStorage,
  createMemoryStorage,
  createServerSaveStorage,
  type ApiRequest,
  type KeyValueStorage,
} from '~~/app/utils/save-storage'

const DAY = 86_400_000

const namedSave = (name: string): SavedState => ({ ...blankSave(), name })

/** A reading with `miningXp` in Mining and nothing anywhere else. */
function reading(miningXp: number): XpReading {
  return {
    skills: forEverySkill((skill) => (skill === 'mining' ? miningXp : 0)),
    totalXp: miningXp,
  }
}

function storageHolding(values: Record<string, unknown>): KeyValueStorage {
  const storage = createMemoryStorage()
  for (const [key, value] of Object.entries(values)) storage.setItem(key, JSON.stringify(value))
  return storage
}

describe('the browser storage', () => {
  it('has no save for a first visit', async () => {
    expect(await createBrowserSaveStorage(createMemoryStorage()).readSave()).toBeNull()
  })

  it('reads back the save it wrote', async () => {
    const storage = createBrowserSaveStorage(createMemoryStorage())
    await storage.writeSave(namedSave('Zezima'))
    expect(await storage.readSave()).toEqual(namedSave('Zezima'))
  })

  it('migrates a save the vanilla app left under its own key, and leaves it where it was', async () => {
    const legacy: LegacySaveV1 = { v: 1, name: 'Old Timer', prefs: { mood: 'afk', minutes: 120 } }
    const browser = storageHolding({ 'longgame.state.v1': legacy })
    const save = await createBrowserSaveStorage(browser).readSave()
    expect(save?.version).toBe(2)
    expect(save?.name).toBe('Old Timer')
    expect(save?.preferences.mood).toBe('afk')
    expect(save?.preferences.minutes).toBe(120)
    expect(browser.getItem('longgame.state.v1')).toBe(JSON.stringify(legacy))
  })

  it("prefers this app's own save to the vanilla app's once there is one", async () => {
    const browser = storageHolding({ 'longgame.state.v1': { v: 1, name: 'Old Timer' } })
    const storage = createBrowserSaveStorage(browser)
    await storage.writeSave(namedSave('New Name'))
    expect((await storage.readSave())?.name).toBe('New Name')
  })

  it('treats a save that is not JSON, or not a save, as no save', async () => {
    const garbled = createMemoryStorage()
    garbled.setItem('longgame.save', '{"version":2,"name":"Cut sh')
    expect(await createBrowserSaveStorage(garbled).readSave()).toBeNull()
    const foreign = storageHolding({ 'longgame.save': { version: 99 } })
    expect(await createBrowserSaveStorage(foreign).readSave()).toBeNull()
  })

  it('has no snapshots for a name it has not seen', async () => {
    expect(await createBrowserSaveStorage(createMemoryStorage()).readSnapshots('Zezima')).toEqual(
      [],
    )
  })

  it('records a reading with the time it was taken and returns the whole history', async () => {
    const storage = createBrowserSaveStorage(createMemoryStorage())
    await storage.recordSnapshot('Zezima', reading(100), DAY)
    const history = await storage.recordSnapshot('Zezima', reading(250), 2 * DAY)
    expect(history.map((snapshot) => [snapshot.takenAt, snapshot.totalXp])).toEqual([
      [DAY, 100],
      [2 * DAY, 250],
    ])
    expect(await storage.readSnapshots('Zezima')).toEqual(history)
  })

  it('keeps one history per player, whatever the case or spacing of the name', async () => {
    const storage = createBrowserSaveStorage(createMemoryStorage())
    await storage.recordSnapshot('Lynx Titan', reading(100), DAY)
    await storage.recordSnapshot('Zezima', reading(900), DAY)
    expect(await storage.readSnapshots('lynx_titan')).toHaveLength(1)
    expect((await storage.readSnapshots('LYNX TITAN'))[0]?.totalXp).toBe(100)
  })

  it('moves the last snapshot forward instead of adding a third that says the same', async () => {
    const storage = createBrowserSaveStorage(createMemoryStorage())
    await storage.recordSnapshot('Zezima', reading(100), DAY)
    await storage.recordSnapshot('Zezima', reading(100), 2 * DAY)
    const history = await storage.recordSnapshot('Zezima', reading(100), 5 * DAY)
    expect(history.map((snapshot) => snapshot.takenAt)).toEqual([DAY, 5 * DAY])
  })

  it(`keeps the newest ${BROWSER_SNAPSHOT_LIMIT} snapshots`, async () => {
    const full: XpSnapshot[] = Array.from({ length: BROWSER_SNAPSHOT_LIMIT }, (_unused, day) => ({
      takenAt: day * DAY,
      skills: { mining: day },
      totalXp: day,
    }))
    const browser = storageHolding({ 'longgame.snapshots.zezima': full })
    const history = await createBrowserSaveStorage(browser).recordSnapshot(
      'Zezima',
      reading(5000),
      BROWSER_SNAPSHOT_LIMIT * DAY,
    )
    expect(history).toHaveLength(BROWSER_SNAPSHOT_LIMIT)
    expect(history.at(0)?.takenAt).toBe(DAY)
    expect(history.at(-1)?.totalXp).toBe(5000)
  })

  it("migrates the vanilla app's snapshots and carries on from them", async () => {
    const browser = storageHolding({
      'longgame.snaps.iron_man_99': [
        { t: DAY, skills: { mining: 100, dungeoneering: 5 }, total: 100 },
        'not a snapshot',
        { t: 2 * DAY, skills: { mining: 300 }, total: 300 },
      ],
    })
    const storage = createBrowserSaveStorage(browser)
    expect(await storage.readSnapshots('Iron Man 99')).toEqual([
      { takenAt: DAY, skills: { mining: 100 }, totalXp: 100 },
      { takenAt: 2 * DAY, skills: { mining: 300 }, totalXp: 300 },
    ])
    const history = await storage.recordSnapshot('Iron Man 99', reading(450), 3 * DAY)
    expect(history.map((snapshot) => snapshot.totalXp)).toEqual([100, 300, 450])
    // from now on the history lives under this app's key
    expect(await storage.readSnapshots('Iron Man 99')).toEqual(history)
  })

  it('replaces a history with an imported one, for that player only', async () => {
    const storage = createBrowserSaveStorage(createMemoryStorage())
    await storage.recordSnapshot('Zezima', reading(100), DAY)
    await storage.recordSnapshot('Lynx Titan', reading(900), DAY)
    const imported: XpSnapshot[] = [
      { takenAt: 3 * DAY, skills: { mining: 500 }, totalXp: 500 },
      { takenAt: 4 * DAY, skills: { mining: 700 }, totalXp: 700 },
    ]
    expect(await storage.replaceSnapshots('Zezima', imported)).toEqual(imported)
    expect(await storage.readSnapshots('zezima')).toEqual(imported)
    expect(await storage.readSnapshots('Lynx Titan')).toHaveLength(1)
  })

  it('replaces a history with an empty one, which then hides the vanilla app’s', async () => {
    const browser = storageHolding({
      'longgame.snaps.zezima': [{ t: DAY, skills: { mining: 100 }, total: 100 }],
    })
    const storage = createBrowserSaveStorage(browser)
    expect(await storage.replaceSnapshots('Zezima', [])).toEqual([])
    expect(await storage.readSnapshots('Zezima')).toEqual([])
  })

  it(`keeps the newest ${BROWSER_SNAPSHOT_LIMIT} of an imported history`, async () => {
    const long: XpSnapshot[] = Array.from(
      { length: BROWSER_SNAPSHOT_LIMIT + 5 },
      (_unused, day) => ({ takenAt: day * DAY, skills: { mining: day }, totalXp: day }),
    )
    const kept = await createBrowserSaveStorage(createMemoryStorage()).replaceSnapshots(
      'Zezima',
      long,
    )
    expect(kept).toHaveLength(BROWSER_SNAPSHOT_LIMIT)
    expect(kept.at(0)?.takenAt).toBe(5 * DAY)
    expect(kept.at(-1)).toEqual(long.at(-1))
  })
})

describe('the local server storage', () => {
  /** A stand-in for the local server: remembers the requests and answers from `answers`. */
  function server(answers: Record<string, unknown>) {
    const requests: { path: string; method: string; query?: unknown; body?: unknown }[] = []
    const request: ApiRequest = async (path, options) => {
      const method = options?.method ?? 'GET'
      requests.push({ path, method, query: options?.query, body: options?.body })
      return answers[`${method} ${path}`]
    }
    return { requests, storage: createServerSaveStorage(request) }
  }

  it('reads the empty object the server sends when nothing is saved as no save', async () => {
    expect(await server({ 'GET /api/state': {} }).storage.readSave()).toBeNull()
  })

  it('reads a save, and migrates one from the vanilla app', async () => {
    expect(await server({ 'GET /api/state': namedSave('Zezima') }).storage.readSave()).toEqual(
      namedSave('Zezima'),
    )
    const migrated = await server({
      'GET /api/state': { v: 1, name: 'Old Timer' },
    }).storage.readSave()
    expect(migrated?.version).toBe(2)
    expect(migrated?.name).toBe('Old Timer')
  })

  it('puts the whole save', async () => {
    const { requests, storage } = server({})
    await storage.writeSave(namedSave('Zezima'))
    expect(requests).toEqual([
      { path: '/api/state', method: 'PUT', query: undefined, body: namedSave('Zezima') },
    ])
  })

  it('asks for snapshots by name and keeps only what is a snapshot', async () => {
    const { requests, storage } = server({
      'GET /api/snapshots': [
        { takenAt: DAY, skills: { mining: 100, dungeoneering: 5 }, totalXp: 100 },
        { takenAt: 'yesterday' },
      ],
    })
    expect(await storage.readSnapshots('Zezima')).toEqual([
      { takenAt: DAY, skills: { mining: 100 }, totalXp: 100 },
    ])
    expect(requests[0]?.query).toEqual({ name: 'Zezima' })
  })

  it('posts a reading and returns the history the server then holds', async () => {
    const stored = [{ takenAt: 9 * DAY, skills: { mining: 100 }, totalXp: 100 }]
    const { requests, storage } = server({ 'GET /api/snapshots': stored })
    expect(await storage.recordSnapshot('Zezima', reading(100), DAY)).toEqual(stored)
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'POST /api/snapshots',
      'GET /api/snapshots',
    ])
    // the server stamps the time itself, so none is sent
    expect(requests[0]?.body).toEqual({ name: 'Zezima', ...reading(100) })
  })

  it('refuses to replace a history, and asks the server nothing', async () => {
    const { requests, storage } = server({})
    await expect(storage.replaceSnapshots('Zezima', [])).rejects.toThrow('does not import')
    expect(requests).toEqual([])
  })
})

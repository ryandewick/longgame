import { describe, expect, it } from 'vitest'
import type { XpSnapshot } from '#shared/types/snapshot'
import { forEverySkill } from '#shared/data/skills'
import {
  blankSave,
  noSavedAccounts,
  SAVED_ACCOUNTS_VERSION,
  type LegacySaveV1,
  type SavedAccounts,
  type SavedState,
} from '#shared/domain/save'
import type { XpReading } from '~~/app/utils/hiscores'
import {
  BROWSER_SNAPSHOT_LIMIT,
  createBrowserSaveStorage,
  createMemoryStorage,
  createServerSaveStorage,
  type ApiRequest,
  type KeyValueStorage,
  type OtherTabChanges,
} from '~~/app/utils/save-storage'

const DAY = 86_400_000

const namedSave = (name: string): SavedState => ({
  ...blankSave(),
  name,
  completedQuests: ['Bone Voyage'],
})

/** Saved accounts with these saves, the first open. */
function accountsOf(...saves: SavedState[]): SavedAccounts {
  return { version: SAVED_ACCOUNTS_VERSION, open: saves[0]?.name ?? null, accounts: saves }
}

/** A reading with `miningXp` in Mining and nothing anywhere else. */
function reading(miningXp: number): XpReading {
  return {
    skills: forEverySkill((skill) => (skill === 'mining' ? miningXp : 0)),
    totalXp: miningXp,
  }
}

const snapshotOn = (day: number, miningXp: number): XpSnapshot => ({
  takenAt: day * DAY,
  skills: { mining: miningXp },
  totalXp: miningXp,
})

function storageHolding(values: Record<string, unknown>): KeyValueStorage {
  const storage = createMemoryStorage()
  for (const [key, value] of Object.entries(values)) storage.setItem(key, JSON.stringify(value))
  return storage
}

/** Storage that counts its writes. */
function countingStorage(): KeyValueStorage & { writes: string[] } {
  const inner = createMemoryStorage()
  const writes: string[] = []
  return {
    writes,
    getItem: (key) => inner.getItem(key),
    setItem: (key, value) => {
      writes.push(key)
      inner.setItem(key, value)
    },
  }
}

/** A stand-in for the browser's `storage` event: `tell` is another tab writing. */
function otherTabs(): {
  changes: OtherTabChanges
  tell: (key: string, value: string | null) => void
  stopped: () => boolean
} {
  let heard: ((key: string | null, value: string | null) => void) | null = null
  let isStopped = false
  return {
    changes: (listener) => {
      heard = listener
      return () => {
        isStopped = true
      }
    },
    tell: (key, value) => heard?.(key, value),
    stopped: () => isStopped,
  }
}

describe('the browser storage: the saved accounts', () => {
  it('has no save for a first visit', async () => {
    expect(await createBrowserSaveStorage(createMemoryStorage()).readAccounts()).toBeNull()
  })

  it('reads back the accounts it wrote', async () => {
    const storage = createBrowserSaveStorage(createMemoryStorage())
    const saved = accountsOf(namedSave('Zezima'), namedSave('Lynx Titan'))
    await storage.writeAccounts(saved)
    expect(await storage.readAccounts()).toEqual(saved)
  })

  it('brings the single save of the version before in as the first account, and never writes over it', async () => {
    const single = namedSave('Zezima')
    const browser = storageHolding({ 'longgame.save': single })
    const storage = createBrowserSaveStorage(browser)
    const saved = await storage.readAccounts()
    expect(saved).toEqual(accountsOf(single))
    // the first change is written under the new key; the old save stays behind as it was
    await storage.writeAccounts(accountsOf(single, namedSave('Lynx Titan')))
    expect(browser.getItem('longgame.save')).toBe(JSON.stringify(single))
    expect((await storage.readAccounts())?.accounts.map((save) => save.name)).toEqual([
      'Zezima',
      'Lynx Titan',
    ])
  })

  it('migrates a save the vanilla app left under its own key, and leaves it where it was', async () => {
    const legacy: LegacySaveV1 = { v: 1, name: 'Old Timer', prefs: { mood: 'afk', minutes: 120 } }
    const browser = storageHolding({ 'longgame.state.v1': legacy })
    const saved = await createBrowserSaveStorage(browser).readAccounts()
    expect(saved?.open).toBe('Old Timer')
    const [save] = saved?.accounts ?? []
    expect(save?.version).toBe(2)
    expect(save?.preferences.mood).toBe('afk')
    expect(save?.preferences.minutes).toBe(120)
    expect(browser.getItem('longgame.state.v1')).toBe(JSON.stringify(legacy))
  })

  it("prefers this app's single save to the vanilla app's", async () => {
    const browser = storageHolding({
      'longgame.state.v1': { v: 1, name: 'Old Timer' },
      'longgame.save': namedSave('New Name'),
    })
    expect((await createBrowserSaveStorage(browser).readAccounts())?.open).toBe('New Name')
  })

  it('reads only the saved accounts once there are any, so a forgotten last account stays forgotten', async () => {
    const browser = storageHolding({
      'longgame.accounts': noSavedAccounts(),
      'longgame.save': namedSave('Zezima'),
    })
    expect(await createBrowserSaveStorage(browser).readAccounts()).toEqual(noSavedAccounts())
  })

  it('reads the single save when the saved accounts will not parse', async () => {
    const browser = storageHolding({ 'longgame.save': namedSave('Zezima') })
    browser.setItem('longgame.accounts', '{"version":3,"open":"Zez')
    expect((await createBrowserSaveStorage(browser).readAccounts())?.open).toBe('Zezima')
  })

  it('treats a save that is not JSON, or not a save, as no save', async () => {
    const garbled = createMemoryStorage()
    garbled.setItem('longgame.save', '{"version":2,"name":"Cut sh')
    expect(await createBrowserSaveStorage(garbled).readAccounts()).toBeNull()
    const foreign = storageHolding({
      'longgame.accounts': { version: 99 },
      'longgame.save': { version: 99 },
    })
    expect(await createBrowserSaveStorage(foreign).readAccounts()).toBeNull()
  })

  it('does not write the same accounts twice running', async () => {
    const browser = countingStorage()
    const storage = createBrowserSaveStorage(browser)
    await storage.writeAccounts(accountsOf(namedSave('Zezima')))
    await storage.writeAccounts(accountsOf(namedSave('Zezima')))
    expect(browser.writes).toEqual(['longgame.accounts'])
    await storage.writeAccounts(accountsOf(namedSave('Lynx Titan')))
    expect(browser.writes).toEqual(['longgame.accounts', 'longgame.accounts'])
  })
})

describe('the browser storage: another tab', () => {
  it('hears another tab save the accounts', async () => {
    const tabs = otherTabs()
    const storage = createBrowserSaveStorage(createMemoryStorage(), tabs.changes)
    const heard: SavedAccounts[] = []
    storage.watchOtherTabs((saved) => heard.push(saved))
    const saved = accountsOf(namedSave('Lynx Titan'), namedSave('Zezima'))
    tabs.tell('longgame.accounts', JSON.stringify(saved))
    expect(heard).toEqual([saved])
  })

  it('ignores other keys, a removed key and a value that will not parse', () => {
    const tabs = otherTabs()
    const storage = createBrowserSaveStorage(createMemoryStorage(), tabs.changes)
    const heard: SavedAccounts[] = []
    storage.watchOtherTabs((saved) => heard.push(saved))
    tabs.tell('longgame.snapshots.zezima', '[]')
    tabs.tell('longgame.accounts', null)
    tabs.tell('longgame.accounts', '{"version":3,"op')
    expect(heard).toEqual([])
  })

  it('does not write back the accounts another tab has just saved', async () => {
    const tabs = otherTabs()
    const browser = countingStorage()
    const storage = createBrowserSaveStorage(browser, tabs.changes)
    storage.watchOtherTabs(() => undefined)
    const saved = accountsOf(namedSave('Zezima'))
    tabs.tell('longgame.accounts', JSON.stringify(saved))
    await storage.writeAccounts(saved)
    expect(browser.writes).toEqual([])
  })

  it('stops hearing when asked, and hears nothing without a way to listen', () => {
    const tabs = otherTabs()
    const stop = createBrowserSaveStorage(createMemoryStorage(), tabs.changes).watchOtherTabs(
      () => undefined,
    )
    stop()
    expect(tabs.stopped()).toBe(true)
    const deaf = createBrowserSaveStorage(createMemoryStorage())
    expect(() => deaf.watchOtherTabs(() => undefined)()).not.toThrow()
  })
})

describe('the browser storage: XP history', () => {
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
    const full: XpSnapshot[] = Array.from({ length: BROWSER_SNAPSHOT_LIMIT }, (_unused, day) =>
      snapshotOn(day, day),
    )
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
      snapshotOn(1, 100),
      snapshotOn(2, 300),
    ])
    const history = await storage.recordSnapshot('Iron Man 99', reading(450), 3 * DAY)
    expect(history.map((snapshot) => snapshot.totalXp)).toEqual([100, 300, 450])
    // from now on the history lives under this app's key
    expect(await storage.readSnapshots('Iron Man 99')).toEqual(history)
  })

  it('merges a history into the one kept, for that player only, losing nothing', async () => {
    const storage = createBrowserSaveStorage(createMemoryStorage())
    await storage.recordSnapshot('Zezima', reading(100), DAY)
    await storage.recordSnapshot('Lynx Titan', reading(900), DAY)
    const imported = [snapshotOn(3, 500), snapshotOn(4, 700)]
    const merged = await storage.mergeSnapshots('Zezima', imported)
    expect(merged.map((snapshot) => snapshot.totalXp)).toEqual([100, 500, 700])
    expect(await storage.readSnapshots('zezima')).toEqual(merged)
    expect(await storage.readSnapshots('Lynx Titan')).toHaveLength(1)
  })

  it("merges into a history the vanilla app kept, which keeps it, now under this app's key", async () => {
    const browser = storageHolding({
      'longgame.snaps.zezima': [{ t: DAY, skills: { mining: 100 }, total: 100 }],
    })
    const storage = createBrowserSaveStorage(browser)
    expect(await storage.mergeSnapshots('Zezima', [])).toEqual([snapshotOn(1, 100)])
    expect(browser.getItem('longgame.snapshots.zezima')).toBe(JSON.stringify([snapshotOn(1, 100)]))
  })

  it(`keeps the newest ${BROWSER_SNAPSHOT_LIMIT} of a merged history`, async () => {
    const long: XpSnapshot[] = Array.from({ length: BROWSER_SNAPSHOT_LIMIT + 5 }, (_unused, day) =>
      snapshotOn(day, day),
    )
    const kept = await createBrowserSaveStorage(createMemoryStorage()).mergeSnapshots(
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

  const requested = (requests: { path: string; method: string }[]): string[] =>
    requests.map((request) => `${request.method} ${request.path}`)

  it('reads the empty objects the server sends when nothing is saved as no save', async () => {
    const { requests, storage } = server({ 'GET /api/accounts': {}, 'GET /api/state': {} })
    expect(await storage.readAccounts()).toBeNull()
    expect(requested(requests)).toEqual(['GET /api/accounts', 'GET /api/state'])
  })

  it('reads the saved accounts, and asks for nothing older', async () => {
    const saved = accountsOf(namedSave('Zezima'), namedSave('Lynx Titan'))
    const { requests, storage } = server({ 'GET /api/accounts': saved })
    expect(await storage.readAccounts()).toEqual(saved)
    expect(requested(requests)).toEqual(['GET /api/accounts'])
  })

  it('brings the single save in as the first account while there are no saved accounts', async () => {
    const single = namedSave('Zezima')
    const brought = server({ 'GET /api/accounts': {}, 'GET /api/state': single })
    expect(await brought.storage.readAccounts()).toEqual(accountsOf(single))
    const migrated = await server({
      'GET /api/accounts': {},
      'GET /api/state': { v: 1, name: 'Old Timer' },
    }).storage.readAccounts()
    expect(migrated?.open).toBe('Old Timer')
    expect(migrated?.accounts[0]?.version).toBe(2)
  })

  it('puts every account', async () => {
    const { requests, storage } = server({})
    const saved = accountsOf(namedSave('Zezima'))
    await storage.writeAccounts(saved)
    expect(requests).toEqual([
      { path: '/api/accounts', method: 'PUT', query: undefined, body: saved },
    ])
  })

  it('asks for snapshots by name and keeps only what is a snapshot', async () => {
    const { requests, storage } = server({
      'GET /api/snapshots': [
        { takenAt: DAY, skills: { mining: 100, dungeoneering: 5 }, totalXp: 100 },
        { takenAt: 'yesterday' },
      ],
    })
    expect(await storage.readSnapshots('Zezima')).toEqual([snapshotOn(1, 100)])
    expect(requests[0]?.query).toEqual({ name: 'Zezima' })
  })

  it('posts a reading and returns the history the server then holds', async () => {
    const stored = [snapshotOn(9, 100)]
    const { requests, storage } = server({ 'GET /api/snapshots': stored })
    expect(await storage.recordSnapshot('Zezima', reading(100), DAY)).toEqual(stored)
    expect(requested(requests)).toEqual(['POST /api/snapshots', 'GET /api/snapshots'])
    // the server stamps the time itself, so none is sent
    expect(requests[0]?.body).toEqual({ name: 'Zezima', ...reading(100) })
  })

  it('has the server merge a history, and returns what it then holds', async () => {
    const stored = [snapshotOn(1, 100), snapshotOn(2, 200)]
    const { requests, storage } = server({ 'GET /api/snapshots': stored })
    expect(await storage.mergeSnapshots('Zezima', [snapshotOn(2, 200)])).toEqual(stored)
    expect(requested(requests)).toEqual(['POST /api/snapshots/merge', 'GET /api/snapshots'])
    expect(requests[0]?.body).toEqual({ name: 'Zezima', snapshots: [snapshotOn(2, 200)] })
  })

  it('never hears from another tab, and asks the server nothing for it', () => {
    const { requests, storage } = server({})
    storage.watchOtherTabs(() => {
      throw new Error('a local copy has no other tabs to hear')
    })()
    expect(requests).toEqual([])
  })
})

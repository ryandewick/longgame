import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { forEverySkill } from '#shared/data/skills'
import { blankSave, type SavedHiscores, type SavedState } from '#shared/domain/save'
import { RETURNING_PLAYER_CLASS, RETURNING_PLAYER_SCRIPT } from '~~/app/utils/returning-player'
import {
  createBrowserSaveStorage,
  createMemoryStorage,
  type KeyValueStorage,
} from '~~/app/utils/save-storage'

const hiscores: SavedHiscores = {
  fetchedAt: 1,
  skills: forEverySkill(() => ({ level: 50, xp: 101_333 })),
  totalLevel: 1200,
  totalXp: 2_431_992,
}

const savedAccount: SavedState = { ...blankSave(), name: 'Zezima', hiscores }

/** Runs the head script against this storage and reports the classes it left on <html>. */
function classesAfterScript(localStorage: Pick<Storage, 'getItem'>): string[] {
  const classes: string[] = []
  const document = { documentElement: { classList: { add: (name: string) => classes.push(name) } } }
  new Function('localStorage', 'document', RETURNING_PLAYER_SCRIPT)(localStorage, document)
  return classes
}

function storageHolding(values: Record<string, string>): KeyValueStorage {
  const storage = createMemoryStorage()
  for (const [key, value] of Object.entries(values)) storage.setItem(key, value)
  return storage
}

describe('the returning player script', () => {
  it('marks the document when the app has saved an account', async () => {
    // written by the app's own storage, so this fails if the two files stop agreeing on the key
    const browser = createMemoryStorage()
    await createBrowserSaveStorage(browser).writeSave(savedAccount)
    expect(classesAfterScript(browser)).toEqual([RETURNING_PLAYER_CLASS])
  })

  it('marks the document for an account saved by the vanilla app', async () => {
    const legacy = { v: 1, name: 'Old Timer', hs: { fetched: 1, skills: {} } }
    const browser = storageHolding({ 'longgame.state.v1': JSON.stringify(legacy) })
    // the app itself reads this save as an account too
    expect((await createBrowserSaveStorage(browser).readSave())?.name).toBe('Old Timer')
    expect(classesAfterScript(browser)).toEqual([RETURNING_PLAYER_CLASS])
  })

  it('leaves a first visit alone', () => {
    expect(classesAfterScript(createMemoryStorage())).toEqual([])
  })

  it('leaves the document alone when the save has no account in it', async () => {
    const browser = createMemoryStorage()
    const storage = createBrowserSaveStorage(browser)
    await storage.writeSave(blankSave())
    expect(classesAfterScript(browser)).toEqual([])
    // a name that could not be looked up is not an account yet: the setup screen still shows
    await storage.writeSave({ ...blankSave(), name: 'Zezima' })
    expect(classesAfterScript(browser)).toEqual([])
  })

  it('treats a save that will not parse as a first visit', () => {
    expect(classesAfterScript(storageHolding({ 'longgame.save': '{"name":"Zez' }))).toEqual([])
    expect(classesAfterScript(storageHolding({ 'longgame.save': '"a string"' }))).toEqual([])
  })

  it('treats a browser that refuses storage as a first visit', () => {
    const refusing = {
      getItem: (): string => {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    }
    expect(classesAfterScript(refusing)).toEqual([])
  })

  it('is one line with nothing in it that could close its script tag', () => {
    expect(RETURNING_PLAYER_SCRIPT).not.toMatch(/[\n<]/)
  })
})

describe('the mark on the document', () => {
  const source = (path: string): string =>
    readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

  it('is the class PlannerPage hides the first-visit screen under', () => {
    const plannerPage = source('app/components/PlannerPage.vue')
    expect(plannerPage).toContain(`.${RETURNING_PLAYER_CLASS} .planner-page__first-visit {`)
    expect(plannerPage).toContain('classList.remove(RETURNING_PLAYER_CLASS)')
  })

  it('is set by a script nuxt.config.ts puts in the head of every page', () => {
    expect(source('nuxt.config.ts')).toContain('innerHTML: RETURNING_PLAYER_SCRIPT')
  })
})

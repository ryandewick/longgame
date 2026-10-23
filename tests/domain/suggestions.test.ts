import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Account } from '#shared/types/account'
import { SMALLEST_SAVING_IN_HOURS } from '#shared/domain/plan-questions'
import { accountFromSave, migrateLegacySave, type LegacySaveV1 } from '#shared/domain/save'
import { suggestions } from '#shared/domain/suggestions'
import { accountWith, freshAccount } from './helpers'

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { state: LegacySaveV1 }
const ironFixture: Account = { ...accountFromSave(migrateLegacySave(fixture.state)), type: 'iron' }

describe('suggestions', () => {
  const next = suggestions(ironFixture)

  it('suggests the quests that save the most hours for their time, as mocked (the test account)', () => {
    expect(next.savingHours.slice(0, 4).map(({ quest }) => quest.name)).toEqual([
      'Lunar Diplomacy',
      'Perilous Moons',
      'Sins of the Father',
      'Pandemonium',
    ])
    const moons = next.savingHours.find(({ quest }) => quest.name === 'Perilous Moons')
    expect(moons?.first).toEqual([{ quest: "Twilight's Promise", state: 'finished' }])
    expect(next.savingHours.every(({ hoursSaved }) => hoursSaved >= SMALLEST_SAVING_IN_HOURS)).toBe(
      true,
    )
  })

  it('leaves out a quest whose saving is mostly one it requires: Dream Mentor’s is Lunar Diplomacy’s', () => {
    expect(next.savingHours.map(({ quest }) => quest.name)).not.toContain('Dream Mentor')
    // once Lunar Diplomacy is done, Dream Mentor stands on what it saves itself: under half an hour
    const lunar = {
      ...ironFixture,
      completedQuests: new Set([...ironFixture.completedQuests, 'Lunar Diplomacy']),
    }
    expect(suggestions(lunar).savingHours.map(({ quest }) => quest.name)).not.toContain(
      'Dream Mentor',
    )
  })

  it('offers the unlocks in the account’s own guide’s order (decision 7, acceptance F7)', () => {
    const order = (account: Account) =>
      suggestions(account)
        .unlocks.slice(0, 5)
        .map(({ goal, step }) => [goal.name, step])
    expect(order(freshAccount()).slice(0, 4)).toEqual([
      ['Spirit trees', 17],
      ['Gnome gliders', 41],
      ['Morytania', 45],
      ['Fairy rings', 62],
    ])
    expect(order(freshAccount({ type: 'iron' }))).toEqual([
      ['Spirit trees', 20],
      ['The early ironman path', 42],
      ['Morytania', 50],
      ['Gnome gliders', 69],
      ['Fairy rings', 98],
    ])
  })

  it('gives each unlock its next step, ready or with what it needs (acceptance B1)', () => {
    const [trees, path] = suggestions(freshAccount({ type: 'iron' })).unlocks
    expect(trees?.next).toEqual({ quest: 'Tree Gnome Village', state: 'finished' })
    expect(trees?.readiness.missing).toEqual([])
    // the early milestone of the ironman guide is Holy Grail, with Merlin's Crystal first
    expect(path?.goal.quests).toMatchObject({ 'Holy Grail': 'finished' })
    expect(path?.next).toEqual({ quest: "Merlin's Crystal", state: 'finished' })
  })

  it('shows Barrows gloves after the transport goals both guides reach long before it (acceptance D3)', () => {
    const unlocks = suggestions(freshAccount()).unlocks.map(({ goal }) => goal.id)
    const gloves = unlocks.indexOf('barrows-gloves')
    for (const transport of ['spirit-trees', 'gnome-gliders', 'morytania', 'fairy-rings'])
      expect(unlocks.indexOf(transport)).toBeLessThan(gloves)
  })

  it('never offers a goal the account has done (acceptance C3)', () => {
    expect(next.unlocks.map(({ goal }) => goal.id)).not.toContain('barrows-gloves')
  })

  it('lists the diary tiers the test account can claim, easy and medium ones quickest first (acceptance C4)', () => {
    expect(next.tiers.map(({ diary }) => diary.name)).toEqual([
      'Wilderness Easy',
      'Morytania Easy',
      'Karamja Medium',
      'Fremennik Medium',
    ])
  })

  it('puts a tier that opens a method saving hours before a ready easy tier (decision 6, acceptance F6)', () => {
    // an ironman ready for Desert Hard, which lets Zahur make its unfinished potions
    const account = accountWith({
      type: 'iron',
      everySkill: 70,
      levels: { herblore: 3 },
      allQuests: true,
      diaries: ['Desert Easy', 'Desert Medium'],
    })
    const tiers = suggestions(account).tiers
    expect(tiers[0]?.diary.name).toBe('Desert Hard')
    expect(tiers[0]?.unlockHours).toBeGreaterThanOrEqual(SMALLEST_SAVING_IN_HOURS)
    expect(tiers[0]?.opens).toContain('Potions from your own herbs')
    const firstEasy = tiers.findIndex(({ diary }) => diary.tier === 'Easy')
    expect(firstEasy).toBeGreaterThan(0)
  })

  it('offers a tier once its other tasks are done, a count to build up as its own long task (acceptance F6)', () => {
    const account = accountWith({
      everySkill: 99,
      allQuests: true,
      diaries: ['Western Provinces Easy', 'Western Provinces Medium', 'Western Provinces Hard'],
    })
    const elite = suggestions(account).tiers.find(
      ({ diary }) => diary.name === 'Western Provinces Elite',
    )
    expect(elite?.diary.longTasks.map(({ amount }) => amount)).toEqual([1000])
  })

  it('never suggests Learning the Ropes, and leaves the optional miniquests out of the quest point cape (decision 10, acceptance F9)', () => {
    const all = suggestions(freshAccount())
    expect(all.savingHours.map(({ quest }) => quest.name)).not.toContain('Learning the Ropes')
    const cape = all.unlocks.find(({ goal }) => goal.id === 'quest-point-cape')
    expect(cape).toBeUndefined()
  })
})

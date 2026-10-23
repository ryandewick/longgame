import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Account } from '#shared/types/account'
import type { Goal } from '#shared/types/goal'
import { GOALS } from '#shared/data/goals'
import { goalGroups, goalStanding, goalsFor } from '#shared/domain/goals'
import { accountFromSave, migrateLegacySave, type LegacySaveV1 } from '#shared/domain/save'
import { walkGuide } from './guide-walk'
import { accountWith, freshAccount } from './helpers'

const goal = (id: string): Goal => {
  const found = GOALS.find((each) => each.id === id)
  if (!found) throw new Error(`no goal ${id}`)
  return found
}

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { state: LegacySaveV1 }
const ironFixture: Account = { ...accountFromSave(migrateLegacySave(fixture.state)), type: 'iron' }

describe('goalsFor', () => {
  it('keeps the ironman guide’s early path for ironmen', () => {
    const names = (account: Account) => goalsFor(account).map(({ id }) => id)
    expect(names(freshAccount())).not.toContain('holy-grail-early-path')
    expect(names(freshAccount({ type: 'iron' }))).toContain('holy-grail-early-path')
    expect(names(freshAccount())).toHaveLength(29)
  })
})

describe('goalStanding', () => {
  it('counts Barrows gloves done for the test account, which has Recipe for Disaster (acceptance C3, D4)', () => {
    const standing = goalStanding(ironFixture, goal('barrows-gloves'))
    expect(standing).toMatchObject({ done: true, doneCount: 49, total: 49, steps: [], hours: 0 })
  })

  it('shows Barrows gloves from the start, with its whole tree and how far along it is (acceptance D1, D3)', () => {
    const standing = goalStanding(freshAccount(), goal('barrows-gloves'))
    expect(standing).toMatchObject({ done: false, doneCount: 0, total: 49 })
    // 175 quest points: the tree gives 89, Learning the Ropes 1, so 85 must come from other quests
    expect(standing.questPointsShort).toBe(85)
    const highest = Object.fromEntries(
      standing.levelsShort.map(({ skill, level }) => [skill, level]),
    )
    expect(highest).toMatchObject({
      cooking: 70,
      magic: 59,
      fishing: 53,
      thieving: 53,
      firemaking: 50,
      mining: 50,
      agility: 48,
      crafting: 40,
      ranged: 40,
      smithing: 40,
    })
  })

  it('takes about 27 hours of its own quests and 16 more to make up its quest points (decision 9, acceptance F8)', () => {
    const standing = goalStanding(freshAccount(), goal('barrows-gloves'))
    // 1,640 minutes of the tree, Legends' Quest's start, and the other quests
    expect(standing.minutes / 60).toBeGreaterThan(27 + 2 + 14)
    expect(standing.minutes / 60).toBeLessThan(27 + 3 + 18)
  })

  it('counts a boost the account may use against a level a goal needs', () => {
    // The Grand Tree's 25 Agility: a main buys a summer pie (+5) and trains only to 20
    const main = goalStanding(freshAccount(), goal('gnome-gliders')).levelsShort
    const iron = goalStanding(freshAccount({ type: 'iron' }), goal('gnome-gliders')).levelsShort
    expect(main).toEqual([{ skill: 'agility', level: 25, has: 1, trainTo: 20 }])
    expect(iron).toEqual([{ skill: 'agility', level: 25, has: 1, trainTo: 25 }])
  })

  it('reaches the fairy rings once Fairytale II is started, as the main guide does at step 62 (acceptance A3)', () => {
    const walk = walkGuide('main')
    expect(goalStanding(walk.after(61), goal('fairy-rings')).done).toBe(false)
    expect(goalStanding(walk.after(62), goal('fairy-rings')).done).toBe(true)
  })

  it('needs a goal’s own levels and its tiers, not only its quests', () => {
    // Piety: King's Ransom and Knight Waves, then 70 Prayer and 70 Defence to use it
    const quests = Object.keys(goal('piety').quests)
    const standing = goalStanding(
      accountWith({ quests, levels: { prayer: 52, defence: 75 } }),
      goal('piety'),
    )
    expect(standing).toMatchObject({ done: false, steps: [], diaries: [] })
    expect(standing.levelsShort).toEqual([{ skill: 'prayer', level: 70, has: 52, trainTo: 70 }])
    const cloak = goalStanding(freshAccount(), goal('ardougne-cloak-1'))
    expect(cloak).toMatchObject({ total: 1, diaries: ['Ardougne Easy'] })
  })

  it('needs every quest’s levels and every tier’s for the achievement diary cape (acceptance E4)', () => {
    const cape = goalStanding(freshAccount(), goal('achievement-diary-cape'))
    const questCape = goalStanding(freshAccount(), goal('quest-point-cape'))
    const levels = Object.fromEntries(cape.levelsShort.map(({ skill, level }) => [skill, level]))
    for (const { skill, level } of questCape.levelsShort)
      expect(levels[skill]).toBeGreaterThanOrEqual(level)
    // Magic: 75 for the quests, 96 for Wilderness Elite
    expect(levels.magic).toBe(96)
  })

  it('costs a combat level the cheapest way (decision 11)', () => {
    const standing = goalStanding(walkGuide('main').after(280), goal('vorkath'))
    expect(standing.combatShort).toEqual({ level: 85, has: 71 })
    expect(standing.trainingHours).toBeGreaterThan(0)
  })
})

describe('goalGroups', () => {
  const groups = goalGroups(ironFixture)
  const names = (list: readonly { goal: Goal }[]) => list.map(({ goal: each }) => each.name)

  it('puts the goals one quest away nearly there, nearest first (acceptance C7)', () => {
    expect(names(groups.nearlyThere)).toEqual(
      expect.arrayContaining(['Lunar spellbook', 'Temple Trekking', 'Salve amulet']),
    )
    const steps = (name: string) =>
      groups.nearlyThere
        .find(({ goal: each }) => each.name === name)
        ?.steps.map(({ quest }) => quest)
    expect(steps('Lunar spellbook')).toEqual(['Lunar Diplomacy'])
    expect(steps('Temple Trekking')).toEqual(['In Aid of the Myreque'])
    expect(steps('Salve amulet')).toEqual(['Haunted Mine'])
    const hours = groups.nearlyThere.map(({ hours: each }) => each)
    expect(hours).toEqual([...hours].sort((first, second) => first - second))
  })

  it('says Piety needs King’s Ransom and 70 Prayer (acceptance C7)', () => {
    const piety = [...groups.nearlyThere, ...groups.onTheWay].find(
      ({ goal: each }) => each.id === 'piety',
    )
    expect(piety?.steps.map(({ quest }) => quest)).toEqual([
      "King's Ransom",
      'Knight Waves Training Grounds',
    ])
    expect(piety?.levelsShort).toEqual([{ skill: 'prayer', level: 70, has: 52, trainTo: 70 }])
  })

  it('lists the goals done, Barrows gloves among them, and never as nearly there or on the way', () => {
    expect(names(groups.done)).toContain('Barrows gloves')
    expect([...names(groups.nearlyThere), ...names(groups.onTheWay)]).not.toContain(
      'Barrows gloves',
    )
  })
})

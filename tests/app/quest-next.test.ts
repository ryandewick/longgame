import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Account } from '#shared/types/account'
import { DIARY_FACTS } from '#shared/data/diary-facts'
import { goalGroups } from '#shared/domain/goals'
import { accountFromSave, migrateLegacySave, type LegacySaveV1 } from '#shared/domain/save'
import { suggestions } from '#shared/domain/suggestions'
import { formatMinutes } from '../../app/utils/format'
import { capeCounts, furtherOffLine, goalRows } from '../../app/utils/quest-goals'
import { adviceWords, opensRows, savingRows, tierRows } from '../../app/utils/quest-next'
import { accountWith, freshAccount } from '../domain/helpers'

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { state: LegacySaveV1 }
const ironFixture: Account = { ...accountFromSave(migrateLegacySave(fixture.state)), type: 'iron' }

describe('formatMinutes', () => {
  it('says minutes, then hours and minutes, then hours alone from ten', () => {
    expect([15, 60, 96, 360, 600, 1_382].map(formatMinutes)).toEqual([
      '15 min',
      '1 h',
      '1 h 36 min',
      '6 h',
      '10 h',
      '23 h',
    ])
  })
})

describe('the rows of Next', () => {
  const next = suggestions(ironFixture)

  it('say what a quest that saves hours opens, pays and needs first, with its saving and time', () => {
    const [lunar, moons] = savingRows(next.savingHours)
    expect(lunar).toMatchObject({
      name: 'Lunar Diplomacy',
      first: '',
      saves: { figure: '48', unit: 'hours' },
      takes: '1 h 36 min',
      action: { label: 'Mark done', ariaLabel: 'Mark done: Lunar Diplomacy' },
    })
    expect(lunar?.gives).toMatch(/^Opens .*\. Pays /)
    expect(moons?.first).toBe("First: Twilight's Promise.")
  })

  it('say where the XP with a choice of skill goes, and why (decision 3)', () => {
    expect(
      adviceWords([
        { skill: 'agility', xp: 4_650, reason: 'level' },
        { skill: 'agility', xp: 4_650, reason: 'level' },
      ]),
    ).toBe('Put both rewards on Agility: a goal ahead needs the level.')
    expect(adviceWords([{ skill: 'herblore', xp: 2_500, reason: 'hours' }])).toBe(
      'Put the reward on Herblore: where it saves the most hours.',
    )
    expect(adviceWords([])).toBe('')
  })

  it('say what an unlock’s next quest is to its goal, and what stands in the way', () => {
    const rows = opensRows(next.unlocks)
    expect(rows.find(({ goal }) => goal === 'Temple Trekking')).toMatchObject({
      name: 'In Aid of the Myreque',
      about: 'Temple Trekking: the last quest left.',
      warning: '',
      step: 131,
      state: 'finished',
    })
    // Piety and Chivalry: King's Ransom is ready, and the goal needs 70 Prayer besides
    expect(rows.find(({ goal }) => goal === 'Piety and Chivalry')).toMatchObject({
      name: "King's Ransom",
      about: 'Piety and Chivalry: the next quest, with 1 more after it.',
      warning: 'Piety and Chivalry is short of 70 Prayer (you have 52).',
    })
  })

  it('say what a fresh account’s next quest needs when it is not ready for it', () => {
    const gliders = opensRows(suggestions(freshAccount()).unlocks).find(
      ({ goal }) => goal === 'Gnome gliders',
    )
    expect(gliders).toMatchObject({ name: 'The Grand Tree', warning: 'Needs 25 Agility.' })
  })

  it('say to start a quest that a goal needs only started', () => {
    const account = freshAccount({
      everySkill: 60,
      quests: [
        'Druidic Ritual',
        'Fairytale I - Growing Pains',
        'Lost City',
        'Nature Spirit',
        'Priest in Peril',
        'The Restless Ghost',
      ],
    })
    const rings = opensRows(suggestions(account).unlocks).find(({ goal }) => goal === 'Fairy rings')
    expect(rings).toMatchObject({
      name: 'Fairytale II - Cure a Queen',
      about: 'Fairy rings: start it to get there.',
      state: 'started',
      action: { label: 'Mark started' },
    })
  })

  it('say a tier’s reward, its long task, and the time its tasks take', () => {
    const [wilderness, , karamja] = tierRows(next.tiers)
    expect(wilderness).toMatchObject({
      name: 'Wilderness Easy',
      reward: 'Wilderness sword 1 and Runes from Lundail, with a 2,500 xp lamp.',
      longTask: '',
      takes: '24 min',
    })
    expect(karamja?.longTask).toBe(
      'Then, as a long task of its own: 100% favour in Tai Bwo Wannai (Tai Bwo Wannai Cleanup).',
    )
  })
})

describe('the rows of Goals', () => {
  it('say each goal’s progress, the time left and what is left', () => {
    const rows = goalRows(goalGroups(ironFixture).nearlyThere)
    expect(rows.find(({ id }) => id === 'lunar-spellbook')).toMatchObject({
      name: 'Lunar spellbook',
      gives: 'The Lunar spellbook.',
      progress: '6/7',
      progressLabel: '6 of 7 done',
      left: 'Left: Lunar Diplomacy.',
      short: '',
    })
  })

  it('say the levels a goal is short of, and the quests to start', () => {
    const [piety] = goalRows(
      goalGroups(ironFixture).onTheWay.filter(({ goal }) => goal.id === 'piety'),
    )
    expect(piety).toMatchObject({
      left: "Left: King's Ransom and Knight Waves Training Grounds.",
      short: 'Short of 70 Prayer (52).',
    })
    const rings = goalRows(
      goalGroups(freshAccount()).onTheWay.filter(({ goal }) => goal.id === 'fairy-rings'),
    )[0]
    expect(rings?.left).toMatch(/Start Fairytale II - Cure a Queen|and \d+ more/)
  })

  it('name the goals past the first six on the way', () => {
    const onTheWay = goalGroups(freshAccount()).onTheWay
    expect(furtherOffLine(onTheWay)).toMatch(/^Further off: /)
    expect(furtherOffLine(onTheWay.slice(0, 6))).toBe('')
  })

  it('count the two capes', () => {
    expect(capeCounts(ironFixture)).toEqual({
      questPoints: 199,
      questPointsTotal: 343,
      tiers: 16,
      tiersTotal: DIARY_FACTS.length,
    })
    expect(capeCounts(accountWith({ allQuests: true, allDiaries: true }))).toMatchObject({
      questPoints: 343,
      tiers: 48,
    })
  })
})

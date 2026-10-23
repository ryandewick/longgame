import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Account } from '#shared/types/account'
import { questStepFor, questStepsInOrder } from '#shared/domain/quest-step'
import { accountFromSave, migrateLegacySave, type LegacySaveV1 } from '#shared/domain/save'
import { accountWith, freshAccount } from './helpers'

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { state: LegacySaveV1 }
const ironFixture: Account = { ...accountFromSave(migrateLegacySave(fixture.state)), type: 'iron' }

describe('questStepFor', () => {
  it('deals the test account Twilight’s Promise in two hours, the first step to Perilous Moons, as mocked', () => {
    const step = questStepFor(ironFixture, 120, 'balanced')
    expect(step).toMatchObject({
      title: "Twilight's Promise",
      step: 'finish',
      minutes: 40,
      reason: {
        kind: 'saves',
        quest: 'Perilous Moons',
        opens: ['Sulphur naguas', 'Calcified rocks'],
        between: 0,
      },
    })
    expect(step?.reason.kind === 'saves' && step.reason.hours).toBeCloseTo(33.4, 1)
  })

  it('takes the first thing Next suggests that fits in half the session', () => {
    // Lunar Diplomacy saves the most for its time, but it takes 95 minutes
    expect(questStepFor(ironFixture, 240, 'balanced')).toMatchObject({
      title: 'Lunar Diplomacy',
      minutes: 95,
    })
    expect(questStepFor(ironFixture, 90, 'balanced')?.title).toBe("Twilight's Promise")
    expect(questStepFor(ironFixture, 60, 'balanced')).toMatchObject({
      title: 'Pandemonium',
      minutes: 15,
    })
  })

  it('deals none on an AFK night, since no quest is AFK, nor in a session under an hour', () => {
    expect(questStepFor(ironFixture, 240, 'afk')).toBeNull()
    expect(questStepFor(ironFixture, 30, 'balanced')).toBeNull()
    expect(questStepFor(ironFixture, 120, 'active')?.title).toBe("Twilight's Promise")
  })

  it('deals none when Next has nothing left', () => {
    expect(
      questStepFor(accountWith({ allQuests: true, allDiaries: true }), 240, 'balanced'),
    ).toBeNull()
  })

  it('starts a fresh account on Druidic Ritual, which opens Herblore', () => {
    for (const type of ['main', 'iron'] as const) {
      expect(questStepFor({ ...freshAccount(), type }, 60, 'balanced')).toMatchObject({
        title: 'Druidic Ritual',
        step: 'finish',
        minutes: 10,
        reason: { kind: 'saves', quest: 'Druidic Ritual', between: 0 },
      })
    }
  })
})

describe('questStepsInOrder', () => {
  const order = questStepsInOrder(ironFixture)

  it('tries what saves hours first, in Next’s order, then the guide’s unlocks, then the other tiers', () => {
    expect(order.slice(0, 4).map(({ reason }) => reason.kind === 'saves' && reason.quest)).toEqual([
      'Lunar Diplomacy',
      'Perilous Moons',
      'Sins of the Father',
      'Pandemonium',
    ])
    const kinds = order.map(({ reason }) => reason.kind)
    const firstUnlock = kinds.indexOf('unlock')
    const lastUnlock = kinds.lastIndexOf('unlock')
    expect(firstUnlock).toBeGreaterThan(kinds.lastIndexOf('saves'))
    expect(kinds.slice(firstUnlock, lastUnlock + 1).every((kind) => kind === 'unlock')).toBe(true)
    expect(kinds.slice(lastUnlock + 1).every((kind) => kind === 'tier')).toBe(true)
  })

  it('takes a quest that saves hours by its first step: In Aid of the Myreque, two before Sins of the Father', () => {
    expect(order[2]).toMatchObject({
      title: 'In Aid of the Myreque',
      reason: { kind: 'saves', quest: 'Sins of the Father', between: 2 },
    })
  })

  it('takes the next quest towards a goal, and a diary tier to claim, each rounded to five minutes', () => {
    expect(order).toContainEqual(
      expect.objectContaining({
        title: 'In Aid of the Myreque',
        step: 'finish',
        reason: { kind: 'unlock', goal: 'Temple Trekking', left: 1 },
      }),
    )
    expect(order).toContainEqual(
      expect.objectContaining({ title: 'Wilderness Easy', step: 'claim', minutes: 25 }),
    )
    expect(order.every(({ minutes }) => minutes >= 5 && minutes % 5 === 0)).toBe(true)
  })

  it('makes a quest a goal needs only started a step to start', () => {
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
    expect(questStepsInOrder(account)).toContainEqual(
      expect.objectContaining({
        title: 'Fairytale II - Cure a Queen',
        step: 'start',
        reason: { kind: 'unlock', goal: 'Fairy rings', left: 1 },
      }),
    )
  })
})

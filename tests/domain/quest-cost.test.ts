import { describe, expect, it } from 'vitest'
import type { QuestFacts } from '#shared/types/quest'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import {
  checkSteps,
  questMinutes,
  questPointsFill,
  stepsMinutes,
  stepsToDo,
} from '#shared/domain/quest-cost'
import { accountWith, freshAccount } from './helpers'

const quest = (name: string): QuestFacts => {
  const found = QUEST_FACTS.find((facts) => facts.name === name)
  if (!found) throw new Error(`no quest ${name}`)
  return found
}

describe('questMinutes', () => {
  it('is the mid minutes at an ordinary pace, with an ironman’s gathering and waits on top (decision 9)', () => {
    // Enlightened Journey: 25 minutes, and an ironman grows a willow tree (10 minutes, a 300 minute wait)
    expect(questMinutes(freshAccount(), quest('Enlightened Journey'))).toBe(25)
    expect(questMinutes(freshAccount({ type: 'iron' }), quest('Enlightened Journey'))).toBe(335)
  })

  it('counts a wait every account has', () => {
    // Garden of Tranquillity: Ellamaria's plants take a quarter of an hour to grow
    const minutes = quest('Garden of Tranquillity').time.minutes?.mid ?? 0
    expect(questMinutes(freshAccount(), quest('Garden of Tranquillity'))).toBe(minutes + 15)
  })

  it('is 0 for an entry the data does not time', () => {
    expect(questMinutes(freshAccount(), quest('Recipe for Disaster'))).toBe(0)
    expect(questMinutes(freshAccount(), quest('Knight Waves Training Grounds'))).toBe(0)
  })
})

describe('stepsToDo', () => {
  it('puts every quest after the ones it requires and the ones it needs started', () => {
    const steps = stepsToDo(freshAccount(), { 'Creature of Fenkenstrain': 'finished' })
    const place = (name: string) => steps.findIndex(({ quest: each }) => each === name)
    expect(steps.at(-1)).toEqual({ quest: 'Creature of Fenkenstrain', state: 'finished' })
    expect(place('Priest in Peril')).toBeLessThan(place('Creature of Fenkenstrain'))
    expect(steps).toContainEqual({ quest: 'The Restless Ghost', state: 'started' })
    for (const [index, { quest: name, state }] of steps.entries()) {
      const before =
        state === 'finished'
          ? [...quest(name).requires, ...quest(name).requiresStarted]
          : quest(name).requires
      for (const required of before) {
        if (place(required) >= 0) expect(place(required)).toBeLessThan(index)
      }
    }
  })

  it('leaves out what is done already, and finishes once a quest wanted both started and finished', () => {
    const account = freshAccount({ quests: ['Priest in Peril', 'The Restless Ghost'] })
    expect(stepsToDo(account, { 'Creature of Fenkenstrain': 'finished' })).toEqual([
      { quest: 'Creature of Fenkenstrain', state: 'finished' },
    ])
    expect(
      stepsToDo(freshAccount(), {
        'The Restless Ghost': 'started',
        'Creature of Fenkenstrain': 'finished',
      }).filter(({ quest: name }) => name === 'The Restless Ghost'),
    ).toEqual([{ quest: 'The Restless Ghost', state: 'started' }])
    expect(
      stepsToDo(freshAccount(), {
        'The Restless Ghost': 'finished',
        'Creature of Fenkenstrain': 'finished',
      }).filter(({ quest: name }) => name === 'The Restless Ghost'),
    ).toEqual([{ quest: 'The Restless Ghost', state: 'finished' }])
  })

  it('needs a quest started to have what it requires finished first (the safe reading of acceptance B5)', () => {
    const steps = stepsToDo(freshAccount(), { 'Fairytale II - Cure a Queen': 'started' })
    expect(steps.at(-1)).toEqual({ quest: 'Fairytale II - Cure a Queen', state: 'started' })
    expect(steps.map(({ quest: name }) => name)).toContain('Fairytale I - Growing Pains')
  })
})

describe('checkSteps', () => {
  it('counts what each step done gives towards the next: quest points along the way', () => {
    // Black Knights' Fortress needs 12 quest points
    // Learning the Ropes gives 1, and these four 11 more
    const first = ["Cook's Assistant", 'Sheep Shearer', 'Romeo & Juliet', 'Ernest the Chicken'].map(
      (name) => ({ quest: name, state: 'finished' as const }),
    )
    const fortress = { quest: "Black Knights' Fortress", state: 'finished' as const }
    const account = freshAccount({ everySkill: 30 })
    expect(checkSteps(account, [fortress]).blocked?.readiness.missing).toEqual([
      expect.objectContaining({ kind: 'quest-points', needed: 12 }),
    ])
    expect(checkSteps(account, [...first, fortress]).blocked).toBeNull()
  })

  it('stops at the first step the account is not ready for', () => {
    const steps = stepsToDo(freshAccount(), { 'Fairytale II - Cure a Queen': 'started' })
    const { blocked } = checkSteps(freshAccount(), steps)
    expect(blocked?.readiness.missing.some(({ kind }) => kind === 'skill')).toBe(true)
  })
})

describe('questPointsFill', () => {
  it('makes up Recipe for Disaster’s quest points with about 16 hours of other quests (acceptance F8)', () => {
    const account = freshAccount()
    const tree = new Set(
      stepsToDo(account, { 'Recipe for Disaster': 'finished' }).map(({ quest: name }) => name),
    )
    const fill = questPointsFill(account, tree, 85)
    expect(fill.minutes / 60).toBeGreaterThan(14)
    expect(fill.minutes / 60).toBeLessThan(18)
    expect(fill.quests.some((name) => tree.has(name))).toBe(false)
  })

  it('needs nothing for no shortfall', () => {
    expect(questPointsFill(accountWith(), new Set(), 0)).toEqual({ quests: [], minutes: 0 })
  })
})

describe('stepsMinutes', () => {
  it('adds up the steps’ minutes: Recipe for Disaster’s tree is 1,640 mid minutes and Legends’ Quest’s start (acceptance F8)', () => {
    const steps = stepsToDo(freshAccount(), { 'Recipe for Disaster': 'finished' })
    expect(steps).toHaveLength(49)
    const legends = quest("Legends' Quest").time.minutes?.mid ?? 0
    expect(stepsMinutes(freshAccount(), steps)).toBe(1_640 + legends)
  })
})

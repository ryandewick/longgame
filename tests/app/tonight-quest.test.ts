import { describe, expect, it } from 'vitest'
import type { QuestBlock, QuestStepReason } from '#shared/types/session'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import {
  blockListIcon,
  questStepAsk,
  questStepCaption,
  questStepFact,
  questStepNote,
} from '../../app/utils/tonight-quest'
import {
  blockFact,
  blockNote,
  blockSkill,
  slotCaption,
  slotPlan,
} from '../../app/utils/tonight-session'
import { accountWith } from '../domain/helpers'

const MINUTE = 60_000
const timer = { elapsed: 0, runningSince: null, done: false }

function stepBlock(
  title: string,
  step: QuestBlock['step'],
  minutes: number,
  reason: QuestStepReason,
): QuestBlock {
  return { kind: 'quest', title, step, minutes, reason, ...timer }
}

// the mock-up's step: the first step to Perilous Moons
const twilight = stepBlock("Twilight's Promise", 'finish', 40, {
  kind: 'saves',
  quest: 'Perilous Moons',
  hours: 33.4,
  opens: ['Sulphur naguas', 'Calcified rocks'],
  between: 0,
})
const lunar = stepBlock('Lunar Diplomacy', 'finish', 95, {
  kind: 'saves',
  quest: 'Lunar Diplomacy',
  hours: 48.2,
  opens: ['Courier tasks Lunar Isle route', 'Ourania Altar'],
  between: 0,
})
const myreque = stepBlock('In Aid of the Myreque', 'finish', 65, {
  kind: 'saves',
  quest: 'Sins of the Father',
  hours: 69.7,
  opens: [],
  between: 2,
})
const fairytale = stepBlock('Fairytale II - Cure a Queen', 'start', 30, {
  kind: 'unlock',
  goal: 'Fairy rings',
  left: 1,
})
// on the test account, its reward opens a reset
const wilderness = stepBlock('Wilderness Easy', 'claim', 25, {
  kind: 'tier',
  opens: ['Runes from Lundail'],
})

describe('what a quest step is', () => {
  it('says its kind and its length, at most for a quest to start, which is costed whole', () => {
    expect(questStepFact(twilight)).toBe('Quest, about 40 minutes.')
    expect(questStepFact(fairytale)).toBe('Quest to start, at most 30 minutes.')
    expect(questStepFact(wilderness)).toBe('Diary tier, about 25 minutes.')
    const miniquest = QUEST_FACTS.find(({ kind }) => kind === 'miniquest')?.name ?? ''
    expect(questStepFact(stepBlock(miniquest, 'finish', 10, twilight.reason))).toBe(
      'Miniquest, about 10 minutes.',
    )
  })

  it('names its kind under its slot, with the quest or diary icon', () => {
    expect([twilight, fairytale, wilderness].map(questStepCaption)).toEqual([
      'Quest',
      'Quest to start',
      'Diary tier',
    ])
    expect([twilight, fairytale, wilderness].map(blockListIcon)).toEqual([
      'quest',
      'quest',
      'diary',
    ])
    expect(blockListIcon({ kind: 'wildcard', title: 'Clue scroll', done: false })).toBeNull()
    expect(
      blockListIcon({ kind: 'quest', step: 'claim', title: 'Wilderness Easy', done: true }),
    ).toBe('diary')
  })

  it('is a block like any other on Tonight: no skill, its own fact and note, its length planned', () => {
    expect(blockSkill(twilight)).toBeNull()
    expect(blockFact(twilight, accountWith())).toBe('Quest, about 40 minutes.')
    expect(blockNote(twilight)).toBe(questStepNote(twilight))
    expect(slotCaption(twilight)).toBe('Quest')
    expect(slotPlan(twilight)).toBe('40 min')
  })
})

describe('why a quest step was dealt', () => {
  it('names the quest it leads to, what that opens and the hours it saves, as mocked', () => {
    expect(questStepNote(twilight)).toBe(
      'Perilous Moons comes next: it opens Sulphur naguas and Calcified rocks, 33 hours off your time to max.',
    )
  })

  it('says what a quest that saves hours itself opens', () => {
    expect(questStepNote(lunar)).toBe(
      'Opens Courier tasks Lunar Isle route and Ourania Altar, 48 hours off your time to max.',
    )
  })

  it('counts the quests still between, and says when the saving is the rewards’ alone', () => {
    expect(questStepNote(myreque)).toBe(
      'Sins of the Father comes after 2 more quests: its rewards take 70 hours off your time to max.',
    )
    const oneBetween = { ...myreque, reason: { ...myreque.reason, between: 1 } as const }
    expect(questStepNote(oneBetween)).toContain('Sins of the Father comes after one more quest:')
    const rewardsOnly = stepBlock('Waterfall Quest', 'finish', 30, {
      kind: 'saves',
      quest: 'Waterfall Quest',
      hours: 1.2,
      opens: [],
      between: 0,
    })
    expect(questStepNote(rewardsOnly)).toBe('Its rewards take 1 hour off your time to max.')
  })

  it('says what the step is to its goal, as Next does', () => {
    expect(questStepNote(fairytale)).toBe('Fairy rings: start it to get there.')
    const temple = stepBlock('In Aid of the Myreque', 'finish', 65, {
      kind: 'unlock',
      goal: 'Temple Trekking',
      left: 1,
    })
    expect(questStepNote(temple)).toBe('Temple Trekking: the last quest left.')
    const gliders = stepBlock('The Grand Tree', 'finish', 45, {
      kind: 'unlock',
      goal: 'Gnome gliders',
      left: 4,
    })
    expect(questStepNote(gliders)).toBe('Gnome gliders: the next quest, with 3 more after it.')
  })

  it('says what a tier’s reward is', () => {
    expect(questStepNote(wilderness)).toBe(
      'Wilderness sword 1 and Runes from Lundail, with a 2,500 xp lamp.',
    )
  })
})

describe('what a quest step’s Done asks', () => {
  it('asks whether it was finished, says what a yes leaves ready and what a no leaves, as mocked', () => {
    expect(questStepAsk(twilight, 41 * MINUTE + 12_000)).toEqual({
      fact: 'Quest, 41 minutes logged.',
      question: "Did you finish Twilight's Promise?",
      note: 'Ticking it leaves Perilous Moons, and its 33 hours off, ready to do. Not finished? It stays in Next for another night.',
      yes: 'Yes, tick it',
    })
  })

  it('asks whether a quest to start was started, and marks it started on a yes', () => {
    expect(questStepAsk(fairytale, 25 * MINUTE)).toEqual({
      fact: 'Quest, 25 minutes logged.',
      question: 'Did you start Fairytale II - Cure a Queen?',
      note: 'It is the last quest Fairy rings needs. Not started? It stays in Next for another night.',
      yes: 'Yes, mark it started',
    })
  })

  it('asks whether a tier’s reward was claimed', () => {
    expect(questStepAsk(wilderness, 20 * MINUTE)).toEqual({
      fact: 'Diary tier, 20 minutes logged.',
      question: 'Did you claim the Wilderness Easy reward?',
      note: 'Ticking it opens Runes from Lundail in your plan. Not claimed? It stays in Next for another night.',
      yes: 'Yes, tick it',
    })
    const opensNothing = { ...wilderness, reason: { kind: 'tier', opens: [] } as const }
    expect(questStepAsk(opensNothing, 0).note).toBe(
      'Not claimed? It stays in Next for another night.',
    )
  })

  it('says how far a yes leaves the quest that saves the hours, or the goal', () => {
    expect(questStepAsk(myreque, 0).note).toContain(
      'Ticking it leaves Sins of the Father, and its 70 hours off, 2 quests away.',
    )
    expect(questStepAsk(lunar, 0).note).toContain(
      'Ticking it opens Courier tasks Lunar Isle route and Ourania Altar in your plan.',
    )
    const gliders = stepBlock('The Grand Tree', 'finish', 45, {
      kind: 'unlock',
      goal: 'Gnome gliders',
      left: 2,
    })
    expect(questStepAsk(gliders, 0).note).toContain(
      'Ticking it leaves Gnome gliders one quest away.',
    )
  })

  it('says how long its clock ran, down to none at all', () => {
    expect(questStepAsk(twilight, 0).fact).toBe('Quest, no time logged.')
    expect(questStepAsk(twilight, 30_000).fact).toBe('Quest, under a minute logged.')
    expect(questStepAsk(twilight, MINUTE).fact).toBe('Quest, 1 minute logged.')
  })
})

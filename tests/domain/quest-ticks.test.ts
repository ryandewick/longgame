import { describe, expect, it } from 'vitest'
import { questsRuledOut } from '#shared/domain/quest-chains'
import {
  declineDiary,
  declineQuest,
  tickAll,
  tickDiary,
  tickQuest,
  untickDiary,
  untickQuest,
  type QuestTicks,
} from '#shared/domain/quest-ticks'

/*
 * The chain these lean on, from the wiki: Underground Pass requires Biohazard, which requires
 * Plague City; Regicide requires Underground Pass.
 */

const ticksWith = (overrides: Partial<QuestTicks> = {}): QuestTicks => ({
  completedQuests: [],
  completedDiaries: [],
  declinedQuests: [],
  declinedDiaries: [],
  ...overrides,
})

describe('tickQuest', () => {
  it('ticks every quest the quest requires, and says which', () => {
    const { ticks, alsoChanged } = tickQuest(ticksWith(), 'Underground Pass')
    expect(ticks.completedQuests).toEqual(['Underground Pass', 'Biohazard', 'Plague City'])
    expect(alsoChanged).toEqual(['Biohazard', 'Plague City'])
  })

  it('only reports the quests that were not ticked already', () => {
    const { ticks, alsoChanged } = tickQuest(
      ticksWith({ completedQuests: ['Plague City'] }),
      'Underground Pass',
    )
    expect(ticks.completedQuests).toEqual(['Plague City', 'Underground Pass', 'Biohazard'])
    expect(alsoChanged).toEqual(['Biohazard'])
  })

  it('ticks a quest that requires nothing by itself', () => {
    const { ticks, alsoChanged } = tickQuest(ticksWith(), 'Plague City')
    expect(ticks.completedQuests).toEqual(['Plague City'])
    expect(alsoChanged).toEqual([])
  })

  it('takes the quest and everything it requires off the declined list', () => {
    const { ticks } = tickQuest(
      ticksWith({ declinedQuests: ['Plague City', 'Underground Pass', 'Bone Voyage'] }),
      'Underground Pass',
    )
    expect(ticks.declinedQuests).toEqual(['Bone Voyage'])
  })

  it('lets finishing a quest overrule an earlier "not yet" for one it requires', () => {
    const declined = declineQuest(ticksWith(), 'Plague City')
    expect(questsRuledOut(declined.declinedQuests).has('Underground Pass')).toBe(true)

    const { ticks } = tickQuest(declined, 'Underground Pass')
    expect(ticks.completedQuests).toContain('Plague City')
    expect(ticks.declinedQuests).toEqual([])
  })

  it('hands back the same lists when the quest and its chain were ticked already', () => {
    const before = ticksWith({ completedQuests: ['Plague City', 'Biohazard'] })
    const { ticks, alsoChanged } = tickQuest(before, 'Biohazard')
    expect(ticks.completedQuests).toBe(before.completedQuests)
    expect(ticks.declinedQuests).toBe(before.declinedQuests)
    expect(alsoChanged).toEqual([])
  })

  it('leaves the diaries alone', () => {
    const before = ticksWith({
      completedDiaries: ['Ardougne Easy'],
      declinedDiaries: ['Ardougne Hard'],
    })
    const { ticks } = tickQuest(before, 'Underground Pass')
    expect(ticks.completedDiaries).toBe(before.completedDiaries)
    expect(ticks.declinedDiaries).toBe(before.declinedDiaries)
  })
})

describe('untickQuest', () => {
  const chain = ticksWith({
    completedQuests: ['Plague City', 'Biohazard', 'Underground Pass', 'Regicide', 'Bone Voyage'],
  })

  it('unticks every ticked quest that requires the quest, and says which', () => {
    const { ticks, alsoChanged } = untickQuest(chain, 'Biohazard')
    expect(ticks.completedQuests).toEqual(['Plague City', 'Bone Voyage'])
    expect(alsoChanged).toEqual(['Regicide', 'Underground Pass'])
  })

  it('leaves the quests it requires ticked', () => {
    const { ticks, alsoChanged } = untickQuest(chain, 'Regicide')
    expect(ticks.completedQuests).toEqual([
      'Plague City',
      'Biohazard',
      'Underground Pass',
      'Bone Voyage',
    ])
    expect(alsoChanged).toEqual([])
  })

  it('never leaves a quest ticked without one it requires', () => {
    const { ticks } = untickQuest(chain, 'Plague City')
    expect(ticks.completedQuests).toEqual(['Bone Voyage'])
  })

  it('declines nothing: an unticked quest is unknown again, not refused', () => {
    expect(untickQuest(chain, 'Plague City').ticks.declinedQuests).toEqual([])
  })

  it('hands back the same list for a quest that was not ticked', () => {
    const { ticks, alsoChanged } = untickQuest(chain, 'Dragon Slayer II')
    expect(ticks.completedQuests).toBe(chain.completedQuests)
    expect(alsoChanged).toEqual([])
  })
})

describe('declineQuest', () => {
  it('remembers the quest, once', () => {
    const once = declineQuest(ticksWith(), 'Biohazard')
    expect(once.declinedQuests).toEqual(['Biohazard'])
    expect(declineQuest(once, 'Biohazard').declinedQuests).toBe(once.declinedQuests)
  })

  it('stores only the quest itself: what requires it is worked out, not written down', () => {
    const { declinedQuests } = declineQuest(ticksWith(), 'Plague City')
    expect(declinedQuests).toEqual(['Plague City'])
    expect([...questsRuledOut(declinedQuests)]).toEqual(
      expect.arrayContaining(['Biohazard', 'Underground Pass']),
    )
  })

  it('does not untick or decline a quest that is ticked', () => {
    const before = ticksWith({ completedQuests: ['Plague City'] })
    expect(declineQuest(before, 'Plague City')).toBe(before)
  })
})

describe('diary tiers', () => {
  it('tick, untick and decline one tier at a time, implying nothing about the others', () => {
    const ticked = tickDiary(ticksWith(), 'Ardougne Hard')
    expect(ticked.completedDiaries).toEqual(['Ardougne Hard'])

    const declined = declineDiary(ticked, 'Ardougne Easy')
    expect(declined.completedDiaries).toEqual(['Ardougne Hard'])
    expect(declined.declinedDiaries).toEqual(['Ardougne Easy'])

    expect(untickDiary(declined, 'Ardougne Hard').completedDiaries).toEqual([])
  })

  it('take a "not yet" back when the tier is ticked', () => {
    const declined = declineDiary(ticksWith(), 'Ardougne Medium')
    const ticked = tickDiary(declined, 'Ardougne Medium')
    expect(ticked.completedDiaries).toEqual(['Ardougne Medium'])
    expect(ticked.declinedDiaries).toEqual([])
  })

  it('do not decline a tier that is ticked', () => {
    const before = ticksWith({ completedDiaries: ['Ardougne Medium'] })
    expect(declineDiary(before, 'Ardougne Medium')).toBe(before)
  })

  it('have nothing to do with quests, in either direction', () => {
    // the Ardougne diaries need Underground Pass and more in the game; none of that is inferred
    const ticked = tickDiary(ticksWith({ declinedQuests: ['Plague City'] }), 'Ardougne Elite')
    expect(ticked.completedQuests).toEqual([])
    expect(ticked.declinedQuests).toEqual(['Plague City'])
  })
})

describe('tickAll', () => {
  it('ticks each quest with its chain and each diary tier, once', () => {
    const ticks = tickAll(
      ticksWith({ completedQuests: ['Dragon Slayer I'], declinedDiaries: ['Desert Hard'] }),
      ['Biohazard', 'Dragon Slayer I', 'Biohazard'],
      ['Desert Hard', 'Desert Easy'],
    )
    expect(ticks.completedQuests).toEqual(['Dragon Slayer I', 'Biohazard', 'Plague City'])
    expect(ticks.completedDiaries).toEqual(['Desert Hard', 'Desert Easy'])
    expect(ticks.declinedDiaries).toEqual([])
  })

  it('hands back the same lists when there is nothing new', () => {
    const before = ticksWith({
      completedQuests: ['Plague City'],
      completedDiaries: ['Desert Easy'],
    })
    const ticks = tickAll(before, ['Plague City'], ['Desert Easy'])
    expect(ticks.completedQuests).toBe(before.completedQuests)
    expect(ticks.completedDiaries).toBe(before.completedDiaries)
  })
})

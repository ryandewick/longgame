import { describe, expect, it } from 'vitest'
import {
  buildQuestChains,
  questDependants,
  questPrerequisites,
  questsRuledOut,
} from '#shared/domain/quest-chains'

describe('buildQuestChains', () => {
  // Finale needs Middle and Side; Middle needs Start; Side needs Start; Other needs Middle
  const chains = buildQuestChains(
    new Map([
      ['Finale', ['Middle', 'Side']],
      ['Middle', ['Start']],
      ['Side', ['Start']],
      ['Other', ['Middle']],
    ]),
  )

  it('follows what a quest requires all the way back, each quest once, in name order', () => {
    expect(chains.prerequisitesOf('Finale')).toEqual(['Middle', 'Side', 'Start'])
    expect(chains.prerequisitesOf('Middle')).toEqual(['Start'])
  })

  it('follows what requires a quest all the way forward', () => {
    expect(chains.dependantsOf('Start')).toEqual(['Finale', 'Middle', 'Other', 'Side'])
    expect(chains.dependantsOf('Middle')).toEqual(['Finale', 'Other'])
  })

  it('has nothing either way for a quest that stands alone or is not known', () => {
    expect(chains.prerequisitesOf('Start')).toEqual([])
    expect(chains.dependantsOf('Finale')).toEqual([])
    expect(chains.prerequisitesOf('Never heard of it')).toEqual([])
    expect(chains.dependantsOf('Never heard of it')).toEqual([])
  })
})

describe('questPrerequisites and questDependants', () => {
  it('read the chains in the wiki’s data', () => {
    expect(questPrerequisites('Underground Pass')).toEqual(['Biohazard', 'Plague City'])
    expect(questPrerequisites('Plague City')).toEqual([])
    expect(questDependants('Plague City')).toEqual(
      expect.arrayContaining(['Biohazard', 'Underground Pass', 'Regicide', 'Song of the Elves']),
    )
    expect(questDependants('Plague City')).not.toContain('Plague City')
  })

  it('are each other’s mirror', () => {
    for (const required of questPrerequisites('Dragon Slayer II')) {
      expect(questDependants(required), required).toContain('Dragon Slayer II')
    }
  })
})

describe('questsRuledOut', () => {
  it('rules out every quest that requires one the player has not done', () => {
    const ruledOut = questsRuledOut(['Plague City'])
    expect(ruledOut.has('Biohazard')).toBe(true)
    expect(ruledOut.has('Song of the Elves')).toBe(true)
  })

  it('leaves the declined quest itself out, and every quest that does not depend on it', () => {
    const ruledOut = questsRuledOut(['Biohazard'])
    expect(ruledOut.has('Biohazard')).toBe(false)
    expect(ruledOut.has('Plague City')).toBe(false)
    expect(ruledOut.has('Bone Voyage')).toBe(false)
  })

  it('rules nothing out when nothing was declined', () => {
    expect(questsRuledOut([]).size).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { hoursInWords, listInWords } from '../../app/utils/quest-words'

describe('hoursInWords', () => {
  it('writes the unit out', () => {
    expect(hoursInWords(431.8)).toBe('432 hours')
    expect(hoursInWords(1.4)).toBe('1 hour')
    expect(hoursInWords(0.5)).toBe('30 minutes')
    expect(hoursInWords(2388)).toBe('2,388 hours')
  })
})

describe('listInWords', () => {
  it('joins names the way a sentence does', () => {
    expect(listInWords([])).toBe('')
    expect(listInWords(['Minnows'])).toBe('Minnows')
    expect(listInWords(['Plague City', 'Biohazard'])).toBe('Plague City and Biohazard')
    expect(listInWords(['Vyrewatch Sentinels', 'Blisterwood tree', 'Hallowed Sepulchre'])).toBe(
      'Vyrewatch Sentinels, Blisterwood tree and Hallowed Sepulchre',
    )
  })

  it('counts what it has no room to name', () => {
    expect(listInWords(['A', 'B', 'C', 'D'])).toBe('A, B, C and 1 more')
    expect(listInWords(['A', 'B', 'C', 'D', 'E'], 2)).toBe('A, B and 3 more')
  })

  it('sets names apart with semicolons when one has a comma of its own', () => {
    expect(listInWords(['Herb tar', 'Antifire, ranging, magic potions', 'Super restores'])).toBe(
      'Herb tar; Antifire, ranging, magic potions; and Super restores',
    )
    expect(listInWords(['Attack, strength, energy potions', 'Herb tar', 'A', 'B'], 2)).toBe(
      'Attack, strength, energy potions; Herb tar; and 2 more',
    )
    // a comma in a name that is not shown changes nothing
    expect(listInWords(['A', 'B', 'C, D'], 2)).toBe('A, B and 1 more')
  })
})

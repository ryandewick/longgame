import { describe, expect, it } from 'vitest'
import type { Quest } from '#shared/types/quest'
import { METHODS } from '#shared/data/methods'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import { QUESTS } from '#shared/data/quests'
import { RESETS } from '#shared/data/resets'
import { SKILL_KEYS } from '#shared/data/skills'
import { WILDCARDS } from '#shared/data/wildcards'
import {
  describeQuestRewards,
  gatingDiaries,
  gatingQuests,
  knownQuests,
  levelsShort,
  questFacts,
  questTotalXp,
} from '#shared/domain/quests'
import { accountWith } from './helpers'

function questWith(overrides: Partial<Quest> = {}): Quest {
  return { name: 'Test quest', kind: 'quest', fixedXp: {}, skillLevelsNeeded: {}, ...overrides }
}

const dragonSlayer = questWith({
  name: 'Dragon Slayer II',
  fixedXp: { agility: 50_000, mining: 60_000, smithing: 80_000, thieving: 50_000 },
  lamps: { description: 'Four 25,000 xp lamps for any skill.', totalXp: 100_000 },
  skillLevelsNeeded: { mining: 68, smithing: 70, magic: 75 },
})
const lampsOnly = questWith({
  name: 'The Blood Moon Rises',
  lamps: { description: 'Six 30,000 xp lamps for any skill.', totalXp: 180_000 },
})
const small = questWith({ name: "Cook's Assistant", fixedXp: { cooking: 300 } })

describe('questTotalXp', () => {
  it('adds the lamps to the fixed XP', () => {
    expect(questTotalXp(dragonSlayer)).toBe(340_000)
    expect(questTotalXp(lampsOnly)).toBe(180_000)
    expect(questTotalXp(small)).toBe(300)
    expect(questTotalXp(questWith())).toBe(0)
  })
})

describe('describeQuestRewards', () => {
  it('lists the fixed XP, then the lamps as a sentence of their own', () => {
    expect(describeQuestRewards(dragonSlayer)).toBe(
      'Agility 50k, Mining 60k, Smithing 80k, Thieving 50k. Four 25,000 xp lamps for any skill.',
    )
  })

  it('gives fixed XP alone no full stop, as the list is not a sentence', () => {
    expect(describeQuestRewards(small)).toBe('Cooking 300')
  })

  it('is the lamps alone for a quest that pays nothing else', () => {
    expect(describeQuestRewards(lampsOnly)).toBe('Six 30,000 xp lamps for any skill.')
  })
})

describe('gatingQuests', () => {
  const gating = gatingQuests()

  it('names every quest a method, a reset or a wildcard asks for', () => {
    const asked = [
      ...SKILL_KEYS.flatMap((skill) => METHODS[skill]),
      ...RESETS,
      ...WILDCARDS,
    ].flatMap((gated) => gated.requirements.quests)
    expect(asked.length).toBeGreaterThan(0)
    for (const quest of asked) expect(gating).toContain(quest)
    expect(gating).toHaveLength(new Set(asked).size)
  })

  it('includes a quest only a reset needs and one only a wildcard needs', () => {
    expect(gating).toContain('Tears of Guthix')
    expect(gating).toContain('Temple of the Eye')
  })

  it('is in code-point order with no quest twice', () => {
    expect(gating).toEqual([...new Set(gating)].sort())
  })
})

describe('gatingDiaries', () => {
  const gating = gatingDiaries()

  it('names every diary tier a method, a reset or a wildcard asks for, each once, in order', () => {
    const asked = [
      ...SKILL_KEYS.flatMap((skill) => METHODS[skill]),
      ...RESETS,
      ...WILDCARDS,
    ].flatMap((gated) => gated.requirements.diaries)
    expect(asked.length).toBeGreaterThan(0)
    for (const diary of asked) expect(gating).toContain(diary)
    expect(gating).toEqual([...new Set(gating)].sort())
    expect(gating).toContain('Ardougne Medium')
  })
})

describe('knownQuests', () => {
  it('is every entry of the quest facts, each once, in order, which takes in every quest that pays XP or gates something', () => {
    const known = knownQuests()
    expect(known).toEqual(QUEST_FACTS.map((quest) => quest.name))
    for (const quest of QUESTS) expect(known).toContain(quest.name)
    for (const quest of gatingQuests()) expect(known).toContain(quest)
    expect(known).toEqual([...new Set(known)].sort())
    // quests that neither pay XP nor gate anything are known too
    expect(known).toContain('Rune Mysteries')
    expect(known).toContain('Learning the Ropes')
  })

  it('lists the facts it is given, in their order', () => {
    const given = QUEST_FACTS.slice(0, 2)
    expect(knownQuests(given)).toEqual(given.map((quest) => quest.name))
  })
})

describe('questFacts and levelsShort', () => {
  it('find an entry by its name, and nothing for a name the data does not have', () => {
    expect(questFacts('Watchtower')?.kind).toBe('quest')
    expect(questFacts('Knight Waves Training Grounds')?.kind).toBe('activity')
    expect(questFacts('Tutorial Island')).toBeUndefined()
  })

  it('names the levels an account is short of, in the order given', () => {
    const account = accountWith({ levels: { mining: 60, magic: 80 } })
    expect(levelsShort(account, { mining: 68, magic: 75, smithing: 70 })).toEqual([
      { skill: 'mining', level: 68 },
      { skill: 'smithing', level: 70 },
    ])
  })
})

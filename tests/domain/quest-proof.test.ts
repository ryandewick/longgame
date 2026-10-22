import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DIARY_FACTS } from '#shared/data/diary-facts'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import { hasStartedQuest } from '#shared/domain/account'
import { questPrerequisites } from '#shared/domain/quest-chains'
import {
  diaryProvesFinished,
  higherTiers,
  inDiaryOrder,
  lowerTiers,
  neededStartedBy,
  provenProgress,
  startedMatters,
  type TickedProgress,
} from '#shared/domain/quest-proof'
import { startQuest, tickDiary, type QuestTicks } from '#shared/domain/quest-ticks'
import { accountFromSave, migrateLegacySave, type LegacySaveV1 } from '#shared/domain/save'

const ticked = (overrides: Partial<TickedProgress> = {}): TickedProgress => ({
  completedQuests: [],
  startedQuests: [],
  completedDiaries: [],
  ...overrides,
})

describe('provenProgress', () => {
  it('proves every quest a finished quest requires, all the way along', () => {
    const { completedQuests } = provenProgress(ticked({ completedQuests: ['Regicide'] }))
    expect([...completedQuests].sort()).toEqual([
      'Biohazard',
      'Plague City',
      'Regicide',
      'Underground Pass',
    ])
  })

  it('proves the quests a finished quest needs only started, started', () => {
    const proven = provenProgress(ticked({ completedQuests: ['Creature of Fenkenstrain'] }))
    expect([...proven.startedQuests]).toEqual(['The Restless Ghost'])
    expect(proven.completedQuests.has('The Restless Ghost')).toBe(false)
  })

  it('proves nothing more from a started quest: it can be started before what it needs is done', () => {
    const proven = provenProgress(ticked({ startedQuests: ['Ratcatchers'] }))
    expect([...proven.startedQuests]).toEqual(['Ratcatchers'])
    expect(proven.completedQuests.size).toBe(0)
  })

  it('proves the tiers below a claimed tier, and the quests their tasks need', () => {
    const proven = provenProgress(ticked({ completedDiaries: ['Ardougne Medium'] }))
    expect([...proven.completedDiaries].sort()).toEqual(['Ardougne Easy', 'Ardougne Medium'])
    // Ardougne Easy needs Biohazard and Rune Mysteries; Medium needs Underground Pass and more
    for (const quest of ['Biohazard', 'Plague City', 'Rune Mysteries', 'Underground Pass']) {
      expect(proven.completedQuests.has(quest), quest).toBe(true)
    }
    expect([...proven.startedQuests].sort()).toEqual([
      'Fairytale II - Cure a Queen',
      'Sea Slug',
      'Watchtower',
    ])
  })

  it('never keeps a quest as started once it is proven finished', () => {
    const proven = provenProgress(
      ticked({ completedQuests: ['Watchtower'], completedDiaries: ['Ardougne Medium'] }),
    )
    expect(proven.completedQuests.has('Watchtower')).toBe(true)
    expect(proven.startedQuests.has('Watchtower')).toBe(false)
  })

  it('proves what every tier would under the diary cape shortcut', () => {
    const proven = provenProgress(ticked(), true)
    expect(proven.completedDiaries.size).toBe(48)
    expect(proven.startedQuests.has('Fairytale II - Cure a Queen')).toBe(true)
    expect(proven.completedQuests.has('Lunar Diplomacy')).toBe(true)
  })

  it('keeps a name it does not know as it is', () => {
    const proven = provenProgress(
      ticked({
        completedQuests: ['A Quest From Next Month'],
        completedDiaries: ['Varrock Master'],
      }),
    )
    expect([...proven.completedQuests]).toEqual(['A Quest From Next Month'])
    expect([...proven.completedDiaries]).toEqual(['Varrock Master'])
  })
})

describe('the tiers of a diary', () => {
  it('know the tiers below and above one', () => {
    expect(lowerTiers('Kourend & Kebos Hard')).toEqual([
      'Kourend & Kebos Easy',
      'Kourend & Kebos Medium',
    ])
    expect(higherTiers('Kourend & Kebos Hard')).toEqual(['Kourend & Kebos Elite'])
    expect(lowerTiers('Varrock Easy')).toEqual([])
    expect(higherTiers('Varrock Elite')).toEqual([])
    expect(lowerTiers('Varrock Master')).toEqual([])
  })

  it('come in the game’s order: region by region, easiest first', () => {
    expect(
      inDiaryOrder(['Desert Easy', 'Ardougne Elite', 'Varrock Master', 'Ardougne Easy']),
    ).toEqual(['Ardougne Easy', 'Ardougne Elite', 'Desert Easy', 'Varrock Master'])
  })

  it('say whether a claimed tier proves a quest finished, through what it requires too', () => {
    expect(diaryProvesFinished('Ardougne Medium', 'Underground Pass')).toBe(true)
    expect(diaryProvesFinished('Ardougne Medium', 'Plague City')).toBe(true)
    // needed only started
    expect(diaryProvesFinished('Ardougne Medium', 'Fairytale II - Cure a Queen')).toBe(false)
    expect(diaryProvesFinished('Varrock Master', 'Plague City')).toBe(false)
  })
})

describe('neededStartedBy', () => {
  it('names the finished quests and claimed tiers that need a quest started, tiers last', () => {
    const proven = provenProgress(
      ticked({
        completedQuests: ['Curse of the Empty Lord', 'Creature of Fenkenstrain'],
        completedDiaries: ['Kandarin Easy'],
      }),
    )
    expect(neededStartedBy('The Restless Ghost', proven)).toEqual([
      'Creature of Fenkenstrain',
      'Curse of the Empty Lord',
    ])
    expect(neededStartedBy('Elemental Workshop I', proven)).toEqual(['Kandarin Easy'])
    expect(neededStartedBy('Plague City', proven)).toEqual([])
  })
})

describe('startedMatters', () => {
  it('is true for the 30 quests something needs only started, and no other', () => {
    const matter = QUEST_FACTS.filter((quest) => startedMatters(quest.name)).map((q) => q.name)
    expect(matter).toHaveLength(30)
    expect(matter).toEqual(
      expect.arrayContaining(['Fairytale II - Cure a Queen', 'The Giant Dwarf']),
    )
    expect(startedMatters("Cook's Assistant")).toBe(false)
  })

  it('covers every quest the data needs only started', () => {
    const needed = [
      ...QUEST_FACTS.flatMap((quest) => quest.requiresStarted),
      ...DIARY_FACTS.flatMap((diary) =>
        Object.entries(diary.quests)
          .filter(([, state]) => state === 'started')
          .map(([quest]) => quest),
      ),
    ]
    expect(needed.filter((quest) => !startedMatters(quest))).toEqual([])
  })
})

/*
 * Acceptance cases C1, C2, C5 and F2 (release/research/quests/acceptance.md), on the fixture
 * account (tests/fixtures/account.json): what a save from before stage 2 proves once read.
 */
describe('the acceptance cases of build stage 2', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
  ) as { state: LegacySaveV1 }
  const save = migrateLegacySave(fixture.state)
  const account = accountFromSave(save)
  const names = new Set(QUEST_FACTS.map((quest) => quest.name))

  it('C1: every ticked name is an entry, and Recipe for Disaster stands for its parts: 108 entries', () => {
    expect(save.completedQuests).toHaveLength(106)
    expect(save.completedQuests.filter((name) => !names.has(name))).toEqual([])
    const withParts = new Set([
      ...save.completedQuests,
      ...questPrerequisites('Recipe for Disaster').filter((part) =>
        part.startsWith('Recipe for Disaster - '),
      ),
    ])
    expect(withParts.size).toBe(108)
  })

  it('C2: the nine entries the old app could not tick are proven by the quests ticked: 117 entries', () => {
    const proven = [...account.completedQuests].filter(
      (name) => !save.completedQuests.includes(name) && !name.startsWith('Recipe for Disaster - '),
    )
    expect(proven.sort()).toEqual([
      "Alfred Grimhand's Barcrawl",
      "Black Knights' Fortress",
      'Demon Slayer',
      'Ernest the Chicken',
      "Merlin's Crystal",
      "Pirate's Treasure",
      'Rune Mysteries',
      'Shield of Arrav',
      'Troll Stronghold',
    ])
    expect(account.completedQuests.size).toBe(117)
  })

  it('C5: Fairytale II reads as started, which the fixture’s own Medium tiers prove', () => {
    // the research expected the fixture to need Fairytale II marked by hand; its ticked Ardougne,
    // Kandarin and Lumbridge & Draynor Medium tiers already need it started, so it is
    expect(hasStartedQuest(account, 'Fairytale II - Cure a Queen')).toBe(true)
    expect(account.completedQuests.has('Fairytale II - Cure a Queen')).toBe(false)
    const proven = provenProgress(save)
    expect(neededStartedBy('Fairytale II - Cure a Queen', proven)).toEqual([
      'Ardougne Medium',
      'Kandarin Medium',
      'Lumbridge & Draynor Medium',
    ])
  })

  it('F2: a quest marked started is started, a finished quest counts as started, a tier proves the tiers below', () => {
    const none: QuestTicks = {
      completedQuests: [],
      startedQuests: [],
      completedDiaries: [],
      declinedQuests: [],
      declinedDiaries: [],
    }
    const started = startQuest(none, 'Fairytale II - Cure a Queen').ticks
    expect(started.startedQuests).toEqual(['Fairytale II - Cure a Queen'])
    expect(
      hasStartedQuest(
        accountFromSave({ ...save, ...none, completedQuests: ['Biohazard'] }),
        'Biohazard',
      ),
    ).toBe(true)
    expect(tickDiary(none, 'Desert Hard').ticks.completedDiaries).toEqual([
      'Desert Hard',
      'Desert Easy',
      'Desert Medium',
    ])
    // the tiers whose started need Fairytale II meets, as the research reads their pages
    for (const tier of ['Ardougne Medium', 'Fremennik Medium', 'Kandarin Medium']) {
      const diary = DIARY_FACTS.find((facts) => facts.name === tier)
      expect(diary?.quests['Fairytale II - Cure a Queen'], tier).toBe('started')
    }
  })
})

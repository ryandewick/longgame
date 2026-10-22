import { describe, expect, it } from 'vitest'
import { questsRuledOut } from '#shared/domain/quest-chains'
import {
  closeTicks,
  declineDiary,
  declineQuest,
  startQuest,
  tickAll,
  tickDiary,
  tickQuest,
  untickDiary,
  untickQuest,
  type QuestTicks,
} from '#shared/domain/quest-ticks'

/*
 * The facts these lean on, from the wiki through the quest research: Underground Pass requires
 * Biohazard, which requires Plague City, and Regicide requires Underground Pass. Creature of
 * Fenkenstrain requires Priest in Peril finished and The Restless Ghost only started; Elemental
 * Workshop II requires Elemental Workshop I. The Kandarin Easy diary needs Elemental Workshop I
 * started; Wilderness Easy needs Enter the Abyss (which requires Rune Mysteries) and Wilderness
 * Medium needs Between a Rock... started.
 */

const ticksWith = (overrides: Partial<QuestTicks> = {}): QuestTicks => ({
  completedQuests: [],
  startedQuests: [],
  completedDiaries: [],
  declinedQuests: [],
  declinedDiaries: [],
  ...overrides,
})

describe('closeTicks', () => {
  it('writes in every quest a ticked quest requires, and what a claimed tier needs', () => {
    const ticks = closeTicks(
      ticksWith({ completedQuests: ['Underground Pass'], completedDiaries: ['Kandarin Easy'] }),
    )
    expect(ticks.completedQuests).toEqual(['Underground Pass', 'Biohazard', 'Plague City'])
    expect(ticks.startedQuests).toEqual(['Elemental Workshop I'])
  })

  it('marks started the quests a finished quest needs only started', () => {
    const ticks = closeTicks(ticksWith({ completedQuests: ['Creature of Fenkenstrain'] }))
    expect(ticks.completedQuests).toEqual(['Creature of Fenkenstrain', 'Priest in Peril'])
    expect(ticks.startedQuests).toEqual(['The Restless Ghost'])
  })

  it('ticks the tiers below a claimed tier, and what their tasks need', () => {
    const ticks = closeTicks(ticksWith({ completedDiaries: ['Wilderness Medium'] }))
    expect(ticks.completedDiaries).toEqual(['Wilderness Medium', 'Wilderness Easy'])
    expect(ticks.completedQuests).toEqual(['Enter the Abyss', 'Rune Mysteries'])
    expect(ticks.startedQuests).toEqual(['Between a Rock...'])
  })

  it('counts a ticked Desert Hard as Desert Easy and Medium too', () => {
    const ticks = closeTicks(ticksWith({ completedDiaries: ['Desert Hard'] }))
    expect(ticks.completedDiaries).toEqual(['Desert Hard', 'Desert Easy', 'Desert Medium'])
  })

  it('no longer keeps a quest as started once it is proven finished', () => {
    const ticks = closeTicks(
      ticksWith({
        completedQuests: ['Elemental Workshop II'],
        startedQuests: ['Elemental Workshop I'],
      }),
    )
    expect(ticks.completedQuests).toEqual(['Elemental Workshop II', 'Elemental Workshop I'])
    expect(ticks.startedQuests).toEqual([])
  })

  it('leaves nothing declined that it proves done', () => {
    const ticks = closeTicks(
      ticksWith({
        completedDiaries: ['Wilderness Medium'],
        declinedQuests: ['Rune Mysteries', 'Bone Voyage'],
        declinedDiaries: ['Wilderness Easy', 'Wilderness Hard'],
      }),
    )
    expect(ticks.declinedQuests).toEqual(['Bone Voyage'])
    expect(ticks.declinedDiaries).toEqual(['Wilderness Hard'])
  })

  it('hands back the same ticks when there is nothing to write in', () => {
    const before = closeTicks(ticksWith({ completedQuests: ['Regicide'] }))
    expect(closeTicks(before)).toBe(before)
  })
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
    const { ticks, alsoChanged, alsoStarted } = tickQuest(ticksWith(), 'Plague City')
    expect(ticks.completedQuests).toEqual(['Plague City'])
    expect(alsoChanged).toEqual([])
    expect(alsoStarted).toEqual([])
  })

  it('marks started the quests it needs only started, and says which', () => {
    const { ticks, alsoChanged, alsoStarted } = tickQuest(ticksWith(), 'Creature of Fenkenstrain')
    expect(ticks.startedQuests).toEqual(['The Restless Ghost'])
    expect(alsoChanged).toEqual(['Priest in Peril'])
    expect(alsoStarted).toEqual(['The Restless Ghost'])
  })

  it('stops keeping a started quest as started once it is ticked done', () => {
    const { ticks } = tickQuest(
      ticksWith({ startedQuests: ['The Giant Dwarf'] }),
      'The Giant Dwarf',
    )
    expect(ticks.completedQuests).toEqual(['The Giant Dwarf'])
    expect(ticks.startedQuests).toEqual([])
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
      completedDiaries: ['Karamja Easy'],
      declinedDiaries: ['Karamja Hard'],
    })
    const { ticks, diariesChanged } = tickQuest(before, 'Underground Pass')
    expect(ticks.completedDiaries).toBe(before.completedDiaries)
    expect(ticks.declinedDiaries).toBe(before.declinedDiaries)
    expect(diariesChanged).toEqual([])
  })
})

describe('untickQuest', () => {
  const chain = ticksWith({
    completedQuests: [
      'Plague City',
      'Biohazard',
      'Underground Pass',
      'Regicide',
      "Cook's Assistant",
    ],
  })

  it('unticks every ticked quest that requires the quest, and says which', () => {
    const { ticks, alsoChanged } = untickQuest(chain, 'Biohazard')
    expect(ticks.completedQuests).toEqual(['Plague City', "Cook's Assistant"])
    expect(alsoChanged).toEqual(['Regicide', 'Underground Pass'])
  })

  it('leaves the quests it requires ticked', () => {
    const { ticks, alsoChanged } = untickQuest(chain, 'Regicide')
    expect(ticks.completedQuests).toEqual([
      'Plague City',
      'Biohazard',
      'Underground Pass',
      "Cook's Assistant",
    ])
    expect(alsoChanged).toEqual([])
  })

  it('never leaves a quest ticked without one it requires', () => {
    const { ticks } = untickQuest(chain, 'Plague City')
    expect(ticks.completedQuests).toEqual(["Cook's Assistant"])
  })

  it('unticks the claimed tiers that need it finished, and the tiers above them', () => {
    const claimed = tickDiary(ticksWith(), 'Wilderness Medium').ticks
    const { ticks, alsoChanged, diariesChanged } = untickQuest(claimed, 'Rune Mysteries')
    expect(ticks.completedDiaries).toEqual([])
    expect(diariesChanged).toEqual(['Wilderness Easy', 'Wilderness Medium'])
    expect(alsoChanged).toEqual(['Enter the Abyss'])
    // what the tiers proved stays, as a quest's prerequisites do when it is unticked
    expect(ticks.startedQuests).toEqual(['Between a Rock...'])
  })

  it('takes a quest back only to started while a finished quest needs it started, and says which', () => {
    const before = tickQuest(
      ticksWith({ completedQuests: ['The Restless Ghost'] }),
      'Creature of Fenkenstrain',
    ).ticks
    const { ticks, heldStartedBy } = untickQuest(before, 'The Restless Ghost')
    expect(ticks.completedQuests).not.toContain('The Restless Ghost')
    expect(ticks.startedQuests).toEqual(['The Restless Ghost'])
    expect(heldStartedBy).toEqual(['Creature of Fenkenstrain'])
  })

  it('takes a quest back only to started while a claimed tier needs it started, and says which', () => {
    const before = tickQuest(
      ticksWith({ completedDiaries: ['Kandarin Easy'] }),
      'Elemental Workshop I',
    ).ticks
    const { ticks, heldStartedBy } = untickQuest(before, 'Elemental Workshop I')
    expect(ticks.startedQuests).toEqual(['Elemental Workshop I'])
    expect(ticks.completedDiaries).toEqual(['Kandarin Easy'])
    expect(heldStartedBy).toEqual(['Kandarin Easy'])
  })

  it('takes a started quest back to not started when nothing needs it started', () => {
    const { ticks, heldStartedBy } = untickQuest(
      ticksWith({ startedQuests: ['The Giant Dwarf'] }),
      'The Giant Dwarf',
    )
    expect(ticks.startedQuests).toEqual([])
    expect(heldStartedBy).toEqual([])
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

describe('startQuest', () => {
  it('marks a quest started and proves nothing else about it', () => {
    const { ticks, alsoChanged, alsoStarted } = startQuest(ticksWith(), 'Ratcatchers')
    expect(ticks.startedQuests).toEqual(['Ratcatchers'])
    expect(ticks.completedQuests).toEqual([])
    expect(alsoChanged).toEqual([])
    expect(alsoStarted).toEqual([])
  })

  it('unticks a quest that was done first, with what needs it finished', () => {
    const before = tickQuest(ticksWith(), 'Elemental Workshop II').ticks
    const { ticks, alsoChanged } = startQuest(before, 'Elemental Workshop I')
    expect(ticks.completedQuests).toEqual([])
    expect(ticks.startedQuests).toEqual(['Elemental Workshop I'])
    expect(alsoChanged).toEqual(['Elemental Workshop II'])
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

  it('declines a started quest: "not yet" says it is not finished', () => {
    const before = ticksWith({ startedQuests: ['The Giant Dwarf'] })
    const { declinedQuests, startedQuests } = declineQuest(before, 'The Giant Dwarf')
    expect(declinedQuests).toEqual(['The Giant Dwarf'])
    expect(startedQuests).toEqual(['The Giant Dwarf'])
  })
})

describe('diary tiers', () => {
  it('tick the tiers below with a tier, and what their tasks need, and say what', () => {
    const { ticks, diariesChanged, alsoChanged, alsoStarted } = tickDiary(
      ticksWith(),
      'Wilderness Medium',
    )
    expect(ticks.completedDiaries).toEqual(['Wilderness Medium', 'Wilderness Easy'])
    expect(diariesChanged).toEqual(['Wilderness Easy'])
    expect(alsoChanged).toEqual(['Enter the Abyss', 'Rune Mysteries'])
    expect(alsoStarted).toEqual(['Between a Rock...'])
  })

  it('take a "not yet" back for the tier and the tiers below it', () => {
    const declined = declineDiary(declineDiary(ticksWith(), 'Ardougne Easy'), 'Ardougne Hard')
    const { ticks } = tickDiary(declined, 'Ardougne Medium')
    expect(ticks.declinedDiaries).toEqual(['Ardougne Hard'])
  })

  it('untick the tiers above with a tier, and leave the quests they proved', () => {
    const claimed = tickDiary(ticksWith(), 'Wilderness Medium').ticks
    const { ticks, diariesChanged } = untickDiary(claimed, 'Wilderness Easy')
    expect(ticks.completedDiaries).toEqual([])
    expect(diariesChanged).toEqual(['Wilderness Medium'])
    expect(ticks.completedQuests).toEqual(claimed.completedQuests)
    expect(ticks.startedQuests).toEqual(claimed.startedQuests)
  })

  it('untick a top tier by itself', () => {
    const claimed = tickDiary(ticksWith(), 'Wilderness Medium').ticks
    const { ticks, diariesChanged } = untickDiary(claimed, 'Wilderness Medium')
    expect(ticks.completedDiaries).toEqual(['Wilderness Easy'])
    expect(diariesChanged).toEqual([])
  })

  it('do not decline a tier that is ticked', () => {
    const before = ticksWith({ completedDiaries: ['Ardougne Medium'] })
    expect(declineDiary(before, 'Ardougne Medium')).toBe(before)
  })
})

describe('tickAll', () => {
  it('ticks each quest with its chain, each started quest whose start matters, and each tier, once', () => {
    const ticks = tickAll(
      ticksWith({ completedQuests: ['Dragon Slayer I'], declinedDiaries: ['Desert Easy'] }),
      {
        quests: ['Biohazard', 'Dragon Slayer I', 'Biohazard'],
        // Biohazard is reported done as well, and nothing needs Cook's Assistant only started
        started: ['The Giant Dwarf', 'Biohazard', "Cook's Assistant"],
        diaries: ['Desert Easy'],
      },
    )
    expect(ticks.completedQuests).toEqual(['Dragon Slayer I', 'Biohazard', 'Plague City'])
    expect(ticks.startedQuests).toEqual(['The Giant Dwarf', "Icthlarin's Little Helper"])
    expect(ticks.completedDiaries).toEqual(['Desert Easy'])
    expect(ticks.declinedDiaries).toEqual([])
  })

  it('hands back the same lists when there is nothing new', () => {
    const before = closeTicks(
      ticksWith({ completedQuests: ['Plague City'], completedDiaries: ['Desert Easy'] }),
    )
    const ticks = tickAll(before, { quests: ['Plague City'], diaries: ['Desert Easy'] })
    expect(ticks).toBe(before)
  })
})

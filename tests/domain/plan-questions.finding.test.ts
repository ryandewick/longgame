import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Account } from '#shared/types/account'
import { maxProgress } from '#shared/domain/estimates'
import { planQuestions, savesHours } from '#shared/domain/plan-questions'
import { declineDiary, declineQuest, tickQuest, type QuestTicks } from '#shared/domain/quest-ticks'
import { accountFromSave, migrateLegacySave, type LegacySaveV1 } from '#shared/domain/save'

/*
 * The measurement the question flow was designed on, kept as it was taken: before the app knew
 * which quests require which, and before it knew the levels a quest needs. Both are switched off
 * here (every quest's facts lose their `requires` and their levels), which is the only reason this
 * is a file of its own. With them on the same account needs fewer questions (see
 * plan-questions.test.ts): one yes settles a chain, and a quest the account's levels rule out is
 * never asked.
 */
vi.mock('#shared/data/quest-facts', async (importOriginal) => {
  const { QUEST_FACTS } = await importOriginal<typeof import('#shared/data/quest-facts')>()
  return { QUEST_FACTS: QUEST_FACTS.map((quest) => ({ ...quest, requires: [], levels: {} })) }
})

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { state: LegacySaveV1 }

const truth: Account = { ...accountFromSave(migrateLegacySave(fixture.state)), type: 'iron' }

describe('the finding the question flow rests on', () => {
  it('takes the fixture account from 2,819 hours to 2,330 in 13 questions, asked biggest saving first', () => {
    let ticks: QuestTicks = {
      completedQuests: [],
      completedDiaries: [],
      declinedQuests: [],
      declinedDiaries: [],
    }
    const account = (): Account => ({
      ...truth,
      completedQuests: new Set(ticks.completedQuests),
      completedDiaries: new Set(),
    })
    expect(Math.round(maxProgress(account()).hoursLeft)).toBe(2819)

    const asked: string[] = []
    for (;;) {
      const [question] = planQuestions(account(), ticks, savesHours).savingHours
      if (!question) break
      const { kind, name } = question.requirement
      asked.push(name)
      // the account here has no diary tiers, so a diary that saves hours is not done yet
      if (kind === 'diary') ticks = declineDiary(ticks, name)
      else
        ticks = truth.completedQuests.has(name)
          ? tickQuest(ticks, name).ticks
          : declineQuest(ticks, name)
    }

    expect(asked).toEqual([
      'Druidic Ritual',
      'Monkey Madness II',
      'The Blood Moon Rises',
      'Bone Voyage',
      'Family Crest',
      'Sins of the Father',
      'Perilous Moons',
      'Children of the Sun',
      'Lunar Diplomacy',
      'Vale Totems',
      'Desert Hard',
      'Creature of Fenkenstrain',
      'Pandemonium',
    ])
    expect(Math.round(maxProgress(account()).hoursLeft)).toBe(2330)
    // exactly what ticking every quest and diary tier the account has done gives
    expect(maxProgress(account()).hoursLeft).toBeCloseTo(maxProgress(truth).hoursLeft, 6)
  })
})

import type { DiaryFacts } from '../types/diary'
import type { QuestFacts, QuestState } from '../types/quest'
import { DIARY_REGIONS, DIARY_TIERS } from './diaries'
import { DataSourceError } from './sources'
import type { DiaryFactSource } from './sources'

const STATES: readonly string[] = ['finished', 'started']

const isState = (state: string): state is QuestState => STATES.includes(state)

/**
 * Turns datasrc/diary_facts.json into the app's `DiaryFacts`, one per tier, in the game's order:
 * region by region, easiest tier first. Every field is checked: exactly the 48 tiers the app
 * knows, a page and revision for each, quests that are entries of the quest facts, each needed
 * finished or started, and a quest needed started that the quest facts mark as mattering started.
 *
 * Throws a DataSourceError listing everything wrong with the source.
 */
export function buildDiaryFacts(
  source: Readonly<Record<string, DiaryFactSource>>,
  questFacts: readonly QuestFacts[],
): DiaryFacts[] {
  const problems: string[] = []
  const quests = new Map(questFacts.map((quest) => [quest.name, quest]))
  const facts: DiaryFacts[] = []

  for (const region of DIARY_REGIONS) {
    for (const tier of DIARY_TIERS) {
      const name = `${region} ${tier}`
      const entry = source[name]
      if (!entry) {
        problems.push(`${name}: missing`)
        continue
      }
      if (!entry.page.trim()) problems.push(`${name}: no page`)
      if (!(Number.isInteger(entry.rev) && entry.rev > 0))
        problems.push(`${name}: revision ${entry.rev}`)

      const needs: Record<string, QuestState> = {}
      for (const [quest, state] of Object.entries(entry.quests)) {
        const known = quests.get(quest)
        if (!known) problems.push(`${name}: needs '${quest}', which is not a quest entry`)
        if (!isState(state)) {
          problems.push(`${name}: needs '${quest}' ${state}`)
          continue
        }
        if (known && state === 'started' && !known.startedMatters)
          problems.push(
            `${name}: needs '${quest}' started, which is not marked as mattering started`,
          )
        needs[quest] = state
      }
      facts.push({
        name,
        region,
        tier,
        page: entry.page,
        revision: entry.rev,
        quests: needs,
      })
    }
  }

  const known = new Set(facts.map((diary) => diary.name))
  for (const name of Object.keys(source)) {
    if (!known.has(name)) problems.push(`'${name}': not a tier the app knows`)
  }
  if (problems.length)
    throw new DataSourceError(problems.map((problem) => `diary facts: ${problem}`))
  return facts
}

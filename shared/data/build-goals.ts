import type { Goal, GoalGuide } from '../types/goal'
import type { LevelNeed, QuestFacts, QuestState } from '../types/quest'
import { readLevelNeed } from './read-needs'
import { DataSourceError } from './sources'
import type { GoalSource } from './sources'

const STATES: readonly string[] = ['finished', 'started']
const GUIDES: readonly string[] = ['main', 'ironman']

const isState = (state: string): state is QuestState => STATES.includes(state)

/** A guide step: a whole number above 0, or null (with the problem noted) when it is not one. */
function guideStep(problems: string[], where: string, step: number | undefined): number | null {
  if (step === undefined) return null
  if (Number.isInteger(step) && step > 0) return step
  problems.push(`${where}: guide step ${step}`)
  return null
}

/**
 * Turns datasrc/quest_goals.json into the app's goals, in the file's order. Every field is
 * checked: a name and what it gives in words, quests that are entries of the quest facts each
 * needed finished or started (one at least, unless the goal needs a tier, every quest or every
 * tier), tiers the app knows, real levels, and guide steps of the two guides.
 *
 * Throws a DataSourceError listing everything wrong with the source.
 */
export function buildGoals(
  source: Readonly<Record<string, GoalSource>>,
  questFacts: readonly QuestFacts[],
  diaries: readonly string[],
): Goal[] {
  const problems: string[] = []
  const quests = new Set(questFacts.map((quest) => quest.name))

  const goals = Object.entries(source).map(([id, entry]): Goal => {
    const where = `goal ${id}`
    if (!entry.name.trim() || !entry.gives.trim()) problems.push(`${where}: no name or words`)

    const tree: Record<string, QuestState> = {}
    for (const [quest, state] of Object.entries(entry.quests)) {
      if (!quests.has(quest)) problems.push(`${where}: needs '${quest}', not a quest entry`)
      if (isState(state)) tree[quest] = state
      else problems.push(`${where}: needs '${quest}' ${state}`)
    }
    for (const diary of entry.diaries ?? []) {
      if (!diaries.includes(diary)) problems.push(`${where}: needs tier '${diary}'`)
    }
    const needsSomething =
      Object.keys(tree).length || entry.diaries?.length || entry.allQuests || entry.allDiaries
    if (!needsSomething) problems.push(`${where}: needs nothing`)

    const levels: LevelNeed[] = (entry.levels ?? []).flatMap(
      (level) => readLevelNeed(problems, where, level) ?? [],
    )
    for (const route of Object.keys(entry.guide ?? {})) {
      if (!GUIDES.includes(route)) problems.push(`${where}: a guide '${route}'`)
    }
    const guide: GoalGuide = {
      main: guideStep(problems, where, entry.guide?.main),
      ironman: guideStep(problems, where, entry.guide?.ironman),
    }

    return {
      id,
      name: entry.name,
      gives: entry.gives,
      quests: tree,
      diaries: [...(entry.diaries ?? [])],
      levels,
      allQuests: entry.allQuests === true,
      allDiaries: entry.allDiaries === true,
      guide,
      ironmanOnly: entry.ironmanOnly === true,
    }
  })

  if (problems.length) throw new DataSourceError(problems.map((problem) => `goals: ${problem}`))
  return goals
}

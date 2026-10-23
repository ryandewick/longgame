import type { Goal } from '../types/goal'
import source from '../../datasrc/quest_goals.json'
import { buildGoals } from './build-goals'
import { DIARY_FACTS } from './diary-facts'
import { QUEST_FACTS } from './quest-facts'

/** The milestones worth heading for: Barrows gloves, the fairy rings, Piety and the rest. */
export const GOALS: readonly Goal[] = buildGoals(
  source,
  QUEST_FACTS,
  DIARY_FACTS.map((diary) => diary.name),
)

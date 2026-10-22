import type { QuestFacts } from '../types/quest'
import source from '../../datasrc/quest_facts.json'
import { buildQuestFacts } from './build-quest-facts'

/** Every quest, subquest and miniquest the game has, and the two activities, in name order. */
export const QUEST_FACTS: readonly QuestFacts[] = buildQuestFacts(source)

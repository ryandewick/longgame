import type { Quest } from '../types/quest'
import lamps from '../../datasrc/quests_lamps.json'
import fixedXp from '../../datasrc/quests_set.json'
import { buildQuests } from './build-quests'
import { QUEST_FACTS } from './quest-facts'

/** Every quest, miniquest and activity that pays XP, in name order. */
export const QUESTS: readonly Quest[] = buildQuests(fixedXp, lamps, QUEST_FACTS)

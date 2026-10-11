import source from '../../datasrc/quest_prerequisites.json'
import { knownQuests } from '../domain/quests'
import { buildQuestPrerequisites } from './build-quest-prerequisites'

/**
 * Which quests each quest needs finished first, from the wiki's Module:Questreq/data and, for the
 * quests that module has no entry for, from the quest's own wiki page.
 */
export const QUEST_PREREQUISITES = buildQuestPrerequisites(source, knownQuests())

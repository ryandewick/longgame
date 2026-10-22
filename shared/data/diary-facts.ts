import type { DiaryFacts } from '../types/diary'
import source from '../../datasrc/diary_facts.json'
import { buildDiaryFacts } from './build-diary-facts'
import { QUEST_FACTS } from './quest-facts'

/** Every achievement diary tier, region by region, easiest first. */
export const DIARY_FACTS: readonly DiaryFacts[] = buildDiaryFacts(source, QUEST_FACTS)

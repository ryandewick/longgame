import type { Boost } from '../types/boost'
import type { SkillKey } from '../types/skill'
import source from '../../datasrc/boosts.json'
import { buildBoosts } from './build-boosts'

/** The boosts that may count toward a boostable quest or diary level, by skill (decision 1). */
export const BOOSTS: Readonly<Partial<Record<SkillKey, readonly Boost[]>>> = buildBoosts(source)

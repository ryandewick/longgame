import type { Method } from '../types/method'
import type { SkillKey } from '../types/skill'
import agility from '../../datasrc/methods/agility.json'
import attack from '../../datasrc/methods/attack.json'
import construction from '../../datasrc/methods/construction.json'
import cooking from '../../datasrc/methods/cooking.json'
import crafting from '../../datasrc/methods/crafting.json'
import defence from '../../datasrc/methods/defence.json'
import farming from '../../datasrc/methods/farming.json'
import firemaking from '../../datasrc/methods/firemaking.json'
import fishing from '../../datasrc/methods/fishing.json'
import fletching from '../../datasrc/methods/fletching.json'
import herblore from '../../datasrc/methods/herblore.json'
import hunter from '../../datasrc/methods/hunter.json'
import magic from '../../datasrc/methods/magic.json'
import mining from '../../datasrc/methods/mining.json'
import prayer from '../../datasrc/methods/prayer.json'
import ranged from '../../datasrc/methods/ranged.json'
import runecraft from '../../datasrc/methods/runecraft.json'
import sailing from '../../datasrc/methods/sailing.json'
import slayer from '../../datasrc/methods/slayer.json'
import smithing from '../../datasrc/methods/smithing.json'
import strength from '../../datasrc/methods/strength.json'
import thieving from '../../datasrc/methods/thieving.json'
import woodcutting from '../../datasrc/methods/woodcutting.json'
import { buildMethods } from './build-methods'
import { forEverySkill } from './skills'
import { DataSourceError } from './sources'
import type { MethodSourceFile } from './sources'

/** One source file per skill that has methods. Hitpoints has none: it is trained by combat. */
const SOURCE_FILES: Readonly<Partial<Record<SkillKey, MethodSourceFile>>> = {
  attack,
  defence,
  strength,
  ranged,
  prayer,
  magic,
  cooking,
  woodcutting,
  fletching,
  fishing,
  firemaking,
  crafting,
  smithing,
  mining,
  herblore,
  agility,
  thieving,
  slayer,
  farming,
  runecraft,
  hunter,
  construction,
  sailing,
}

function buildSkill(skill: SkillKey): readonly Method[] {
  const file = SOURCE_FILES[skill]
  if (!file) return []
  if (file.skill !== skill) {
    throw new DataSourceError([`datasrc/methods/${skill}.json says it is for '${file.skill}'`])
  }
  return buildMethods(skill, file.methods)
}

/**
 * Every training method, by skill: lowest level first and, within a level, the fastest first.
 * Built once when the module loads; a bad source file stops the app from starting at all.
 */
export const METHODS: Readonly<Record<SkillKey, readonly Method[]>> = forEverySkill(buildSkill)

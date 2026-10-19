import type { LampReward, Quest } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { isSkillKey } from './skills'
import { DataSourceError } from './sources'
import type { FixedQuestXpSource, LampSource } from './sources'

/**
 * The wiki's XP table titles some quests differently from the quest list the player ticks:
 * the Recipe for Disaster subquests above all. The app uses the quest list's names. The wiki's
 * prerequisite module uses the same titles (see build-quest-prerequisites.ts).
 */
export const QUEST_LIST_NAMES: Readonly<Record<string, string>> = {
  'Recipe for Disaster/Freeing King Awowogei': 'Recipe for Disaster - King Awowogei',
  'Recipe for Disaster/Freeing the Mountain Dwarf': 'Recipe for Disaster - Mountain Dwarf',
  'Recipe for Disaster/Freeing the Goblin generals': 'Recipe for Disaster - Wartface & Bentnoze',
  'Recipe for Disaster/Freeing Pirate Pete': 'Recipe for Disaster - Pirate Pete',
  'Recipe for Disaster/Freeing Skrach Uglogwee': 'Recipe for Disaster - Skrach Uglogwee',
  'Recipe for Disaster/Freeing the Lumbridge Guide': 'Recipe for Disaster - Lumbridge Guide',
  'Recipe for Disaster/Freeing Sir Amik Varze': 'Recipe for Disaster - Sir Amik Varze',
  'Recipe for Disaster/Freeing Evil Dave': 'Recipe for Disaster - Evil Dave',
  'Knight Waves': 'Knight Waves Training Grounds',
}

const COUNT_WORDS = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']

/** Monkey Madness I splits its reward between two pairs of skills, which the table cannot say. */
const MONKEY_MADNESS: LampReward = {
  description:
    '35,000 xp each in a chosen pair of Attack, Strength, Defence and Hitpoints, and 20,000 each in the other pair.',
  totalXp: 110_000,
}

const withThousands = (value: number): string => value.toLocaleString('en-US')

const stripQuotes = (text: string): string => text.replace(/^'+|'+$/g, '')

/**
 * Rounds to the nearest whole number, halves going to the even side. The wiki's figures were
 * first rounded this way (1000.5 became 1000), and the quest totals have to keep matching.
 */
function roundHalfToEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction !== 0.5) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}

/** The quest's name as the quest list has it; the Lua source escapes its apostrophes. */
const lampQuestName = (source: LampSource): string => source.name.replaceAll("\\'", "'")

/** A lamp reward in words, with its total XP. */
function buildLampReward(source: LampSource): LampReward {
  if (lampQuestName(source) === 'Monkey Madness I') return MONKEY_MADNESS

  const [xpText = '', countText = ''] = source.rewards.split(',').map((part) => part.trim())
  const xp = Number.parseInt(xpText, 10)
  const count = Number.parseInt(countText, 10)
  let description =
    count === 1
      ? `A ${withThousands(xp)} xp lamp`
      : `${COUNT_WORDS[count]} ${withThousands(xp)} xp lamps`

  const restrictions = source.restrictions.trim()
  if (/^\d+$/.test(restrictions)) {
    description += ` for any skill at level ${restrictions} or above.`
  } else if (stripQuotes(restrictions) === 'None') {
    description += ' for any skill.'
  } else {
    // a list of skill names, which the wiki sometimes breaks over two lines
    const skills = stripQuotes(restrictions)
      .replace(/<br\s*\/?>/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
    description += ` for ${skills.slice(0, -1).join(', ')} or ${skills.at(-1)}.`
  }
  if (source.notes?.includes('at least level')) description += ` ${stripQuotes(source.notes)}.`

  return { description, totalXp: xp * count }
}

/** A quest while it is being put together from the two sources. */
interface QuestDraft {
  name: string
  fixedXp: Partial<Record<SkillKey, number>>
  lamps?: LampReward
  skillLevelsNeeded: Partial<Record<SkillKey, number>>
  miniquest: boolean
}

/**
 * Merges the two quest sources, fixed XP and skill-choice lamps, into one list in name order. A
 * quest's skill levels are its entry in `need` alone. The lamp table lists levels too, but as a
 * summary for readers: it counts the levels of the quests a quest requires, and optional ones.
 * Throws a DataSourceError listing everything wrong with the sources.
 */
export function buildQuests(fixed: FixedQuestXpSource, lamps: readonly LampSource[]): Quest[] {
  const problems: string[] = []
  const quests = new Map<string, QuestDraft>()
  // `need` names a quest as its own table does: the XP table's name, or the lamp table's
  const bySourceName = new Map<string, QuestDraft>()
  const draft = (name: string): QuestDraft => {
    let quest = quests.get(name)
    if (!quest) {
      quest = { name, fixedXp: {}, skillLevelsNeeded: {}, miniquest: false }
      quests.set(name, quest)
    }
    return quest
  }

  for (const [sourceName, xpBySkill] of Object.entries(fixed.xp)) {
    const quest = draft(QUEST_LIST_NAMES[sourceName] ?? sourceName)
    bySourceName.set(sourceName, quest)
    for (const [skill, xp] of Object.entries(xpBySkill)) {
      if (isSkillKey(skill)) quest.fixedXp[skill] = roundHalfToEven(xp)
      else problems.push(`quest ${sourceName}: unknown skill '${skill}'`)
    }
    if (fixed.mini.includes(sourceName)) quest.miniquest = true
  }

  for (const source of lamps) {
    const name = lampQuestName(source)
    const quest = draft(name)
    bySourceName.set(name, quest)
    quest.lamps = buildLampReward(source)
    if (!Number.isFinite(quest.lamps.totalXp)) {
      problems.push(`quest ${quest.name}: lamp rewards '${source.rewards}'`)
    }
  }

  for (const [sourceName, levels] of Object.entries(fixed.need)) {
    const quest = bySourceName.get(sourceName)
    if (!quest) {
      problems.push(`quest ${sourceName}: levels, but no XP or lamps under that name`)
      continue
    }
    for (const [skill, level] of Object.entries(levels)) {
      if (isSkillKey(skill)) quest.skillLevelsNeeded[skill] = level
      else problems.push(`quest ${sourceName}: needs unknown skill '${skill}'`)
    }
  }

  if (problems.length) throw new DataSourceError(problems)
  // plain code-point order, not a locale's: the list must come out the same on every machine
  return [...quests.values()].sort((first, second) =>
    first.name < second.name ? -1 : first.name > second.name ? 1 : 0,
  )
}

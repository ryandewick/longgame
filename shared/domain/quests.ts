import type { Account } from '../types/account'
import type { Quest, QuestFacts } from '../types/quest'
import type { Requirements, SkillRequirement } from '../types/requirement'
import type { SkillKey } from '../types/skill'
import { METHODS } from '../data/methods'
import { QUEST_FACTS } from '../data/quest-facts'
import { RESETS } from '../data/resets'
import { isSkillKey, SKILL_KEYS, skillName } from '../data/skills'
import { WILDCARDS } from '../data/wildcards'
import { formatShortNumber } from './format'

/** A value per skill as the data lists them, which is the order a quest's rewards are read out in. */
function skillEntries(values: Readonly<Partial<Record<SkillKey, number>>>): [SkillKey, number][] {
  const entries: [SkillKey, number][] = []
  for (const [skill, value] of Object.entries(values)) {
    if (isSkillKey(skill)) entries.push([skill, value])
  }
  return entries
}

/** Everything a quest pays: its fixed XP and its lamps together. */
export function questTotalXp(quest: Quest): number {
  const fixed = skillEntries(quest.fixedXp).reduce((sum, [, xp]) => sum + xp, 0)
  return fixed + (quest.lamps?.totalXp ?? 0)
}

const FACTS_BY_NAME: ReadonlyMap<string, QuestFacts> = new Map(
  QUEST_FACTS.map((facts) => [facts.name, facts]),
)

/** What the data knows about a quest, miniquest or activity, by its name; undefined for a name it does not have. */
export function questFacts(name: string): QuestFacts | undefined {
  return FACTS_BY_NAME.get(name)
}

/** Which of these levels is the account still short of? In the order given. */
export function levelsShort(
  account: Account,
  levels: Readonly<Partial<Record<SkillKey, number>>>,
): SkillRequirement[] {
  return skillEntries(levels)
    .filter(([skill, level]) => account.skills[skill].level < level)
    .map(([skill, level]) => ({ skill, level }))
}

/**
 * What a quest pays, in words: 'Agility 50k, Mining 60k. Four 25,000 xp lamps for any skill.'
 * The fixed XP comes first; the lamps follow as their own sentence.
 */
export function describeQuestRewards(quest: Quest): string {
  const fixed = skillEntries(quest.fixedXp)
    .map(([skill, xp]) => `${skillName(skill)} ${formatShortNumber(xp)}`)
    .join(', ')
  if (!quest.lamps) return fixed
  return fixed ? `${fixed}. ${quest.lamps.description}` : quest.lamps.description
}

/** Everything whose requirements can name a quest or a diary tier. */
function everythingGated(): readonly { readonly requirements: Requirements }[] {
  return [...SKILL_KEYS.flatMap((skill) => METHODS[skill]), ...RESETS, ...WILDCARDS]
}

/**
 * The quests that stand between an account and something the planner deals: every quest named
 * in the requirements of a method, a reset or a wildcard. Each once, in plain code-point order
 * so the list comes out the same on every machine.
 */
export function gatingQuests(): string[] {
  return [...new Set(everythingGated().flatMap((gated) => gated.requirements.quests))].sort()
}

/** The diary tiers ('Ardougne Medium') a method, a reset or a wildcard requires, as `gatingQuests` lists quests. */
export function gatingDiaries(): string[] {
  return [...new Set(everythingGated().flatMap((gated) => gated.requirements.diaries))].sort()
}

/**
 * Every quest the app knows by name: the whole of the game's quest list (quests, Recipe for
 * Disaster's parts, miniquests) and the two activities, from the quest facts. Each once, in plain
 * code-point order. Every quest a requirement names is one of them: tests/data/integrity.test.ts
 * holds the data to that.
 */
export function knownQuests(facts: readonly QuestFacts[] = QUEST_FACTS): string[] {
  return facts.map((quest) => quest.name)
}

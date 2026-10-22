import type { Account } from '../types/account'
import type { Quest, QuestFacts } from '../types/quest'
import type { Requirements, SkillRequirement } from '../types/requirement'
import type { SkillKey } from '../types/skill'
import { METHODS } from '../data/methods'
import { QUEST_FACTS } from '../data/quest-facts'
import { QUESTS } from '../data/quests'
import { RESETS } from '../data/resets'
import { isSkillKey, SKILL_KEYS, skillName } from '../data/skills'
import { WILDCARDS } from '../data/wildcards'
import { hasCompletedQuest } from './account'
import { formatShortNumber } from './format'

/** A value per skill as the data lists them, which is the order a quest's rewards are read out in. */
function skillEntries(values: Readonly<Partial<Record<SkillKey, number>>>): [SkillKey, number][] {
  const entries: [SkillKey, number][] = []
  for (const [skill, value] of Object.entries(values)) {
    if (isSkillKey(skill)) entries.push([skill, value])
  }
  return entries
}

/** The skills a quest always pays XP in, in the order the data lists them. */
export function questRewardSkills(quest: Quest): SkillKey[] {
  return skillEntries(quest.fixedXp).map(([skill]) => skill)
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
 * Which of the levels the wiki lists for a quest is the account still short of? In the order the
 * data lists them.
 */
export function questLevelsShort(account: Account, quest: Quest): SkillRequirement[] {
  return levelsShort(account, quest.skillLevelsNeeded)
}

/** A quest the account has not done, with what it pays and what the account still lacks for it. */
export interface QuestOffer {
  readonly quest: Quest
  readonly totalXp: number
  readonly levelsShort: readonly SkillRequirement[]
}

/**
 * The quests still worth doing for their XP: every one the account has not done, the biggest
 * reward first. Quests that pay the same keep the order they were given in (the data's is by name).
 */
export function questOffers(account: Account, quests: readonly Quest[] = QUESTS): QuestOffer[] {
  return quests
    .filter((quest) => !hasCompletedQuest(account, quest.name))
    .map((quest) => ({
      quest,
      totalXp: questTotalXp(quest),
      levelsShort: questLevelsShort(account, quest),
    }))
    .sort((first, second) => second.totalXp - first.totalXp)
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

/** The levels a quest still needs, in words: '68 Mining, 70 Smithing'. */
export function describeLevelsShort(levels: readonly SkillRequirement[]): string {
  return levels.map(({ skill, level }) => `${level} ${skillName(skill)}`).join(', ')
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

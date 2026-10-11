import type { Account } from '../types/account'
import type { MissingRequirement, Requirements, SkillRequirement } from '../types/requirement'
import { DIARY_REGIONS, DIARY_TIERS } from '../data/diaries'
import { isSkillKey, skillName } from '../data/skills'
import { combatLevel, hasCompletedDiary, hasCompletedQuest } from './account'

/*
 * Requirements are written in the data as one string:
 *   'q:Quest|Other quest;s:skill 50,skill 60;d:Region Tier;c:70'
 * q: quests, d: diary tiers, s: skill levels, c: combat level. An empty string means none.
 */

const SKILL_LEVEL_PATTERN = /^(\w+)\s+(\d+)$/

/** Requirements that ask for nothing. */
export const NO_REQUIREMENTS: Requirements = { quests: [], skills: [], diaries: [], combatLevel: 0 }

/**
 * Reads a requirement string. Forgiving: a part it cannot read is left out, so check the string
 * with `requirementProblems` first when it comes from a source that has not been validated.
 */
export function parseRequirements(text: string): Requirements {
  let quests: string[] = []
  let diaries: string[] = []
  let combat = 0
  const skills: SkillRequirement[] = []

  for (const part of text.split(';')) {
    const [type, value] = part.split(':')
    if (!value) continue
    if (type === 'q') quests = value.split('|')
    else if (type === 'd') diaries = value.split('|')
    else if (type === 'c') combat = Number(value) || 0
    else if (type === 's') {
      for (const entry of value.split(',')) {
        const match = SKILL_LEVEL_PATTERN.exec(entry.trim())
        const skill = match?.[1]
        if (!skill || !isSkillKey(skill)) continue
        const requirement = { skill, level: Number(match[2]) }
        // a skill named twice keeps its first place in the list and takes the later level
        const existing = skills.findIndex((other) => other.skill === skill)
        if (existing >= 0) skills[existing] = requirement
        else skills.push(requirement)
      }
    }
  }
  return { quests, skills, diaries, combatLevel: combat }
}

/**
 * What is wrong with this requirement string? Empty when it is sound. The data is checked with
 * this before it is parsed, so a typo fails the build instead of quietly unlocking a method.
 */
export function requirementProblems(text: string): string[] {
  const problems: string[] = []
  const typesSeen = new Set<string>()

  for (const part of text.split(';')) {
    if (!part) continue
    const colon = part.indexOf(':')
    if (colon < 0) {
      problems.push(`bad requirement part '${part}'`)
      continue
    }
    const type = part.slice(0, colon)
    const value = part.slice(colon + 1)
    if (typesSeen.has(type)) problems.push(`requirement type '${type}' appears twice`)
    typesSeen.add(type)
    // the parser reads up to the next colon, so a value holding one would be cut short
    if (value.includes(':')) problems.push(`a colon inside the value of '${part}'`)

    if (type === 'q') {
      for (const quest of value.split('|')) {
        if (!quest.trim()) problems.push(`empty quest name in '${part}'`)
      }
    } else if (type === 's') {
      for (const entry of value.split(',')) {
        const match = SKILL_LEVEL_PATTERN.exec(entry.trim())
        const level = Number(match?.[2])
        if (!match?.[1] || !isSkillKey(match[1]) || !(level >= 1 && level <= 99)) {
          problems.push(`bad skill requirement '${entry}'`)
        }
      }
    } else if (type === 'd') {
      for (const diary of value.split('|')) {
        const lastSpace = diary.lastIndexOf(' ')
        const region = diary.slice(0, Math.max(0, lastSpace))
        const tier = diary.slice(lastSpace + 1)
        if (!DIARY_REGIONS.includes(region) || !DIARY_TIERS.includes(tier)) {
          problems.push(`bad diary requirement '${diary}'`)
        }
      }
    } else if (type === 'c') {
      // combat levels run from 3 (a new account) to 126
      if (!/^\d+$/.test(value) || Number(value) < 3 || Number(value) > 126) {
        problems.push(`bad combat requirement '${value}'`)
      }
    } else {
      problems.push(`unknown requirement type '${type}'`)
    }
  }
  return problems
}

/** What does the account still lack? Always in the order quests, skill levels, diaries, combat. */
export function missingRequirements(
  account: Account,
  requirements: Requirements,
): MissingRequirement[] {
  const missing: MissingRequirement[] = []
  for (const quest of requirements.quests) {
    if (!hasCompletedQuest(account, quest)) missing.push({ kind: 'quest', quest })
  }
  for (const { skill, level } of requirements.skills) {
    if (account.skills[skill].level < level) missing.push({ kind: 'skill', skill, level })
  }
  for (const diary of requirements.diaries) {
    if (!hasCompletedDiary(account, diary)) missing.push({ kind: 'diary', diary })
  }
  if (requirements.combatLevel && combatLevel(account) < requirements.combatLevel) {
    missing.push({ kind: 'combat', level: requirements.combatLevel })
  }
  return missing
}

/**
 * Does the account meet every requirement? `assumed` asks the question for a level the account
 * has not reached yet: that one skill is taken to be at that level, everything else as it is now.
 */
export function meetsRequirements(
  account: Account,
  requirements: Requirements,
  assumed?: SkillRequirement,
): boolean {
  for (const quest of requirements.quests) {
    if (!hasCompletedQuest(account, quest)) return false
  }
  for (const { skill, level } of requirements.skills) {
    const current = assumed?.skill === skill ? assumed.level : account.skills[skill].level
    if (current < level) return false
  }
  for (const diary of requirements.diaries) {
    if (!hasCompletedDiary(account, diary)) return false
  }
  return !(requirements.combatLevel && combatLevel(account) < requirements.combatLevel)
}

/** A missing requirement in words: 'Bone Voyage', '70 Fishing', 'Ardougne Medium diary'. */
export function describeMissingRequirement(missing: MissingRequirement): string {
  switch (missing.kind) {
    case 'quest':
      return missing.quest
    case 'skill':
      return `${missing.level} ${skillName(missing.skill)}`
    case 'diary':
      return `${missing.diary} diary`
    case 'combat':
      return `${missing.level} combat`
    case 'grand-exchange':
      return 'the Grand Exchange'
  }
}

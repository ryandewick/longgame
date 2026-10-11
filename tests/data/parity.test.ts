/*
 * Parity with the data the vanilla app was built with. tests/fixtures/legacy-data.js is what
 * its Python build wrote from the same datasrc/; shared/data must say the same things. Each
 * typed value is turned back into the old shape and compared whole.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Method } from '#shared/types/method'
import type { Quest } from '#shared/types/quest'
import type { Requirements } from '#shared/types/requirement'
import type { Reset } from '#shared/types/reset'
import type { SkillDefinition, SkillKey } from '#shared/types/skill'
import { METHODS } from '#shared/data/methods'
import { QUESTS } from '#shared/data/quests'
import { RESETS } from '#shared/data/resets'
import { SKILL_KEYS, SKILLS } from '#shared/data/skills'

interface LegacyExtra {
  who?: string
  run?: 1
  per?: number
  every?: number
  supply?: 1
  tick?: 1
  start?: 1
  calc?: string
  est?: 1
  setup?: 1
  bands?: [number, number][]
}

type LegacyMethodRow =
  | [number, string, number, string, string, string, string]
  | [number, string, number, string, string, string, string, LegacyExtra]

interface LegacyData {
  SKILLS: { k: string; n: string; cat: string; passive?: 1; daily?: 1 }[]
  METHODS: Record<string, LegacyMethodRow[]>
  QUESTS: {
    n: string
    xp: Record<string, number>
    lamps?: string
    lampXp?: number
    need?: Record<string, number>
    mini?: 1
  }[]
  RESETS: {
    k: string
    n: string
    every: number | string | [number, number][]
    skill: string
    req: string
    note: string
    who?: string
  }[]
}

/** The old data file declares its tables as script globals, so it is run as a script body. */
function loadLegacyData(): LegacyData {
  const source = readFileSync(new URL('../fixtures/legacy-data.js', import.meta.url), 'utf8')
  // run as code on purpose: the file is a checked-in fixture, not input
  const run = new Function(`${source}\nreturn { SKILLS, METHODS, QUESTS, RESETS }`)
  return run() as LegacyData
}

const legacy = loadLegacyData()

/** A requirement as the old data wrote it: 'q:A|B;s:skill 50,skill 60;d:Region Tier;c:70'. */
function legacyRequirementText(requirements: Requirements): string {
  const parts: string[] = []
  if (requirements.quests.length) parts.push('q:' + requirements.quests.join('|'))
  if (requirements.skills.length) {
    parts.push('s:' + requirements.skills.map(({ skill, level }) => `${skill} ${level}`).join(','))
  }
  if (requirements.diaries.length) parts.push('d:' + requirements.diaries.join('|'))
  if (requirements.combatLevel) parts.push('c:' + requirements.combatLevel)
  return parts.join(';')
}

function legacySkill(definition: SkillDefinition): LegacyData['SKILLS'][number] {
  return {
    k: definition.key,
    n: definition.name,
    cat: definition.category,
    ...(definition.passive && { passive: 1 as const }),
    ...(definition.daily && { daily: 1 as const }),
  }
}

function legacyMethodRow(method: Method): LegacyMethodRow {
  // the old build wrote these keys in this order; the comparison does not depend on it
  const extra: LegacyExtra = {
    ...(method.audience !== 'both' && { who: method.audience }),
    ...(method.timedRun && { run: 1 as const }),
    ...(method.timedRun?.xpPerRun && { per: method.timedRun.xpPerRun }),
    ...(method.timedRun?.everyMinutes && { every: method.timedRun.everyMinutes }),
    ...(method.usesOwnSupplies && { supply: 1 as const }),
    ...(method.tickPerfect && { tick: 1 as const }),
    ...(method.questSkip && { start: 1 as const }),
    ...(method.computedRate && { calc: method.computedRate, est: 1 as const }),
    ...(method.perTripSetup && { setup: 1 as const }),
    ...(method.rateBands && {
      bands: method.rateBands.map((band): [number, number] => [band.fromLevel, band.xpPerHour]),
    }),
  }
  const row: LegacyMethodRow = [
    method.level,
    method.name,
    method.xpPerHour,
    method.intensity,
    method.cost,
    legacyRequirementText(method.requirements),
    method.note,
  ]
  return Object.keys(extra).length ? [...row, extra] : row
}

function legacyQuest(quest: Quest): LegacyData['QUESTS'][number] {
  return {
    n: quest.name,
    xp: { ...quest.fixedXp },
    ...(quest.lamps && { lamps: quest.lamps.description, lampXp: quest.lamps.totalXp }),
    ...(Object.keys(quest.skillLevelsNeeded).length && { need: { ...quest.skillLevelsNeeded } }),
    ...(quest.miniquest && { mini: 1 as const }),
  }
}

function legacyReset(reset: Reset): LegacyData['RESETS'][number] {
  const { schedule } = reset
  let every: LegacyData['RESETS'][number]['every']
  switch (schedule.kind) {
    case 'interval':
      every = schedule.minutes
      break
    case 'utc-midnight':
      every = 'utc'
      break
    case 'weekly':
      every = 'weekly'
      break
    case 'by-level':
      every = schedule.steps.map((step): [number, number] => [step.fromLevel, step.minutes])
      break
  }
  return {
    k: reset.key,
    n: reset.name,
    every,
    skill: reset.skill ?? '',
    req: legacyRequirementText(reset.requirements),
    note: reset.note,
    ...(reset.audience !== 'both' && { who: reset.audience }),
  }
}

describe('parity with the vanilla app’s data', () => {
  it('has the same skills in the same order, with the same flags', () => {
    expect(SKILLS.map(legacySkill)).toStrictEqual(legacy.SKILLS)
  })

  it('has methods for the same skills', () => {
    const skillsWithMethods = SKILL_KEYS.filter((skill) => METHODS[skill].length > 0)
    expect(skillsWithMethods).toStrictEqual(Object.keys(legacy.METHODS))
  })

  it.each(SKILL_KEYS)('has the same %s methods in the same order', (skill: SkillKey) => {
    expect(METHODS[skill].map(legacyMethodRow)).toStrictEqual(legacy.METHODS[skill] ?? [])
  })

  it('files every method under its own skill', () => {
    for (const skill of SKILL_KEYS) {
      expect(METHODS[skill].every((method) => method.skill === skill)).toBe(true)
    }
  })

  it('has the same quests in the same order', () => {
    expect(QUESTS.map(legacyQuest)).toStrictEqual(legacy.QUESTS)
  })

  it('has the same resets in the same order', () => {
    expect(RESETS.map(legacyReset)).toStrictEqual(legacy.RESETS)
  })
})

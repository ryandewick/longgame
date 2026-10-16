/*
 * The checks the vanilla app's build ran over datasrc/ before it would write anything, kept as
 * tests, plus the assumptions the rules make about the data. A failure here means a source file
 * needs fixing, not the code.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Method } from '#shared/types/method'
import type { Requirements } from '#shared/types/requirement'
import { METHODS } from '#shared/data/methods'
import { QUEST_PREREQUISITES } from '#shared/data/quest-prerequisites'
import { QUESTS } from '#shared/data/quests'
import { RESETS } from '#shared/data/resets'
import { SKILL_KEYS, SKILLS, isSkillKey } from '#shared/data/skills'
import { QUEST_PREREQUISITE_MODULE } from '#shared/data/sources'
import type { MethodSourceFile, QuestPrerequisiteSource, ResetSource } from '#shared/data/sources'
import { WILDCARDS } from '#shared/data/wildcards'
import { questDependants, questPrerequisites } from '#shared/domain/quest-chains'
import { gatingQuests, knownQuests } from '#shared/domain/quests'
import { requirementProblems } from '#shared/domain/requirements'

const DATASRC = new URL('../../datasrc/', import.meta.url)

const readSource = <Shape>(path: string): Shape =>
  JSON.parse(readFileSync(new URL(path, DATASRC), 'utf8')) as Shape

const methodFiles = readdirSync(new URL('methods/', DATASRC))
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({ file, source: readSource<MethodSourceFile>(`methods/${file}`) }))

const allMethods: readonly Method[] = SKILL_KEYS.flatMap((skill) => METHODS[skill])
const whereIs = (method: Method) => `${method.skill} / ${method.name}`

/** The entries a check fails for, by name, so a failure says which ones to fix. */
const failing = (methods: readonly Method[], isSound: (method: Method) => boolean): string[] =>
  methods.filter((method) => !isSound(method)).map(whereIs)

const duplicates = (values: readonly string[]): string[] =>
  values.filter((value, index) => values.indexOf(value) !== index)

const peakRate = (method: Method): number =>
  Math.max(method.xpPerHour, ...(method.rateBands ?? []).map((band) => band.xpPerHour))

describe('skills', () => {
  it('lists the 24 skills once each', () => {
    expect(SKILLS).toHaveLength(24)
    expect(duplicates(SKILL_KEYS)).toEqual([])
  })

  it('treats only Hitpoints as passive and only Farming as trained by runs', () => {
    expect(SKILLS.filter((skill) => skill.passive).map((skill) => skill.key)).toEqual(['hitpoints'])
    expect(SKILLS.filter((skill) => skill.daily).map((skill) => skill.key)).toEqual(['farming'])
  })

  it('has methods for every skill except the passive ones', () => {
    for (const skill of SKILLS) {
      expect(METHODS[skill.key].length > 0, skill.key).toBe(!skill.passive)
    }
  })
})

describe('datasrc/methods', () => {
  it('has one file per skill, named after it, and every file is part of the app’s data', () => {
    for (const { file, source } of methodFiles) {
      expect(`${source.skill}.json`, file).toBe(file)
      expect(isSkillKey(source.skill), file).toBe(true)
      if (isSkillKey(source.skill)) {
        expect(METHODS[source.skill], file).toHaveLength(source.methods.length)
      }
    }
    expect(methodFiles).toHaveLength(SKILLS.filter((skill) => !skill.passive).length)
  })

  it('writes every requirement so that it parses', () => {
    const problems = methodFiles.flatMap(({ source }) =>
      source.methods.flatMap((method) =>
        requirementProblems(method.req.replace('Vale Totems (miniquest)', 'Vale Totems')).map(
          (problem) => `${source.skill} / ${method.name}: ${problem}`,
        ),
      ),
    )
    expect(problems).toEqual([])
  })

  it('marks a rate as an estimate exactly when the app works it out', () => {
    const mismatched = methodFiles.flatMap(({ source }) =>
      source.methods
        .filter((method) => Boolean(method.est) !== Boolean(method.calc))
        .map((method) => `${source.skill} / ${method.name}`),
    )
    expect(mismatched).toEqual([])
  })

  it('opens every method at a level from 1 to 99', () => {
    expect(
      failing(
        allMethods,
        (method) => Number.isInteger(method.level) && method.level >= 1 && method.level <= 99,
      ),
    ).toEqual([])
  })

  it('keeps every rate within reason', () => {
    // a timed run's rate is XP per hour of time spent on the run, so it runs into the millions
    const limit = (method: Method) => (method.timedRun ? 20_000_000 : 2_000_000)
    expect(
      failing(allMethods, (method) =>
        [method.xpPerHour, ...(method.rateBands ?? []).map((band) => band.xpPerHour)].every(
          (rate) => Number.isInteger(rate) && rate >= 0 && rate <= limit(method),
        ),
      ),
    ).toEqual([])
  })

  it('names the wiki page every method came from', () => {
    expect(failing(allMethods, (method) => method.source.length > 0)).toEqual([])
  })

  it('gives every method a name that is unique in its skill and fits a session card', () => {
    for (const skill of SKILL_KEYS) {
      expect(duplicates(METHODS[skill].map((method) => method.name)), skill).toEqual([])
    }
    expect(
      failing(
        allMethods,
        (method) => method.name.length <= 48 && method.name === method.name.trim(),
      ),
    ).toEqual([])
  })

  it('starts rate bands at the method’s own level and has them ascend', () => {
    expect(
      failing(allMethods, ({ level, xpPerHour, rateBands }) => {
        if (!rateBands) return true
        const [first] = rateBands
        const ascending = rateBands.every(
          (band, index) => index === 0 || band.fromLevel > (rateBands[index - 1]?.fromLevel ?? 0),
        )
        return (
          rateBands.length > 1 &&
          first?.fromLevel === level &&
          first.xpPerHour === xpPerHour &&
          ascending
        )
      }),
    ).toEqual([])
  })

  it('lists each skill’s methods lowest level first and, within a level, fastest first', () => {
    for (const skill of SKILL_KEYS) {
      const methods = METHODS[skill]
      const outOfOrder = methods.filter((method, index) => {
        const previous = methods[index - 1]
        if (!previous) return false
        return (
          previous.level > method.level ||
          (previous.level === method.level && peakRate(previous) < peakRate(method))
        )
      })
      expect(outOfOrder.map(whereIs)).toEqual([])
    }
  })

  it('gives every timed run its XP per run and the minutes between runs', () => {
    expect(
      failing(
        allMethods,
        ({ timedRun }) => !timedRun || (timedRun.xpPerRun > 0 && timedRun.everyMinutes > 0),
      ),
    ).toEqual([])
  })

  it('never works out the rate of a timed run from the account’s levels', () => {
    // a run's XP is scaled by the hourly rate, and a worked-out rate has no base to scale from
    expect(failing(allMethods, (method) => !(method.timedRun && method.computedRate))).toEqual([])
  })

  it('gives a method with a worked-out rate no rate of its own', () => {
    expect(
      failing(
        allMethods,
        (method) => !method.computedRate || (method.xpPerHour === 0 && !method.rateBands),
      ),
    ).toEqual([])
  })

  it('has a rated method at every level, apart from the stretches the wiki does not rate', () => {
    // Ignoring quest gates. Each stretch below is one where the wiki gives no hourly rate; the
    // app covers it with the fallback rate and shows the estimate as rough. A new gap should be
    // a decision, not an accident.
    const gaps: string[] = []
    for (const skill of SKILL_KEYS) {
      for (const accountType of ['main', 'iron'] as const) {
        const unrated: number[] = []
        for (let level = 1; level < 99; level++) {
          const rated = METHODS[skill].some((method) => {
            if (method.level > level) return false
            if (method.audience !== 'both' && method.audience !== accountType) return false
            let rate = method.xpPerHour
            for (const band of method.rateBands ?? []) {
              if (band.fromLevel <= level) rate = band.xpPerHour
            }
            return rate > 0 || method.computedRate !== undefined
          })
          if (!rated) unrated.push(level)
        }
        if (unrated.length && METHODS[skill].length) {
          const contiguous = (unrated.at(-1) ?? 0) - (unrated[0] ?? 0) + 1 === unrated.length
          gaps.push(
            `${skill} ${accountType} ${unrated[0]}-${unrated.at(-1)}${contiguous ? '' : ' (broken)'}`,
          )
        }
      }
    }
    expect(gaps).toEqual([
      'cooking main 1-9',
      'cooking iron 1-27',
      'fishing main 1-19',
      'fishing iron 1-19',
      'mining main 1-14',
      'mining iron 1-14',
      'herblore main 1-2',
      'herblore iron 1-2',
      'slayer main 1-49',
      'slayer iron 1-49',
      'farming main 1-8',
      'farming iron 1-8',
      'hunter main 1-4',
      'hunter iron 1-4',
    ])
  })
})

describe('requirements across the data', () => {
  const everyRequirement: [string, Requirements][] = [
    ...allMethods.map((method): [string, Requirements] => [whereIs(method), method.requirements]),
    ...RESETS.map((reset): [string, Requirements] => [`reset ${reset.key}`, reset.requirements]),
    ...WILDCARDS.map((wildcard): [string, Requirements] => [
      `wildcard ${wildcard.name}`,
      wildcard.requirements,
    ]),
  ]

  it('spells quest names with straight apostrophes, as ticked quests are stored', () => {
    const curly = everyRequirement.filter(([, requirements]) =>
      requirements.quests.some((quest) => quest.includes('’')),
    )
    expect(curly.map(([where]) => where)).toEqual([])
  })

  it('asks for skill levels from 1 to 99, each skill once', () => {
    const unsound = everyRequirement.filter(([, { skills }]) => {
      const keys = skills.map((requirement) => requirement.skill)
      return (
        new Set(keys).size !== keys.length ||
        skills.some((requirement) => requirement.level < 1 || requirement.level > 99)
      )
    })
    expect(unsound.map(([where]) => where)).toEqual([])
  })

  it('never asks for a method’s own skill above the level the method opens at', () => {
    // a method that opens at 50 but asks for 60 in its own skill would contradict itself
    expect(
      failing(allMethods, (method) =>
        method.requirements.skills.every(
          (requirement) => requirement.skill !== method.skill || requirement.level <= method.level,
        ),
      ),
    ).toEqual([])
  })
})

describe('datasrc/resets.json', () => {
  const sources = readSource<ResetSource[]>('resets.json')

  it('is all in the app’s data, in the same order', () => {
    expect(RESETS.map((reset) => reset.key)).toEqual(sources.map((source) => source.k))
  })

  it('gives every reset a key of its own', () => {
    expect(duplicates(RESETS.map((reset) => reset.key))).toEqual([])
  })

  it('writes every requirement so that it parses', () => {
    const problems = sources.flatMap((source) =>
      requirementProblems(source.req ?? '').map((problem) => `${source.k}: ${problem}`),
    )
    expect(problems).toEqual([])
  })

  it('has every cadence come round in a positive number of minutes', () => {
    for (const { key, schedule } of RESETS) {
      if (schedule.kind === 'interval') expect(schedule.minutes, key).toBeGreaterThan(0)
      if (schedule.kind !== 'by-level') continue
      expect(schedule.steps.length, key).toBeGreaterThan(0)
      schedule.steps.forEach((step, index) => {
        expect(step.minutes, key).toBeGreaterThan(0)
        const previous = schedule.steps[index - 1]
        if (previous) expect(step.fromLevel, key).toBeGreaterThan(previous.fromLevel)
      })
    }
  })
})

describe('quests', () => {
  it('lists each quest once, in name order', () => {
    const names = QUESTS.map((quest) => quest.name)
    expect(duplicates(names)).toEqual([])
    expect(names).toEqual([...names].sort())
  })

  it('pays every quest something, in whole XP', () => {
    for (const quest of QUESTS) {
      const fixed = Object.values(quest.fixedXp)
      expect(fixed.length > 0 || quest.lamps !== undefined, quest.name).toBe(true)
      expect(
        fixed.every((xp) => Number.isInteger(xp) && xp > 0),
        quest.name,
      ).toBe(true)
      if (quest.lamps) {
        expect(quest.lamps.totalXp, quest.name).toBeGreaterThan(0)
        expect(quest.lamps.description, quest.name).toMatch(/^[A-Z0-9].*\.$/)
      }
    }
  })

  it('asks for skill levels from 1 to 99', () => {
    for (const quest of QUESTS) {
      for (const [skill, level] of Object.entries(quest.skillLevelsNeeded)) {
        expect(isSkillKey(skill), `${quest.name}: ${skill}`).toBe(true)
        expect(level >= 1 && level <= 99, `${quest.name}: ${skill} ${level}`).toBe(true)
      }
    }
  })
})

describe('quest prerequisites', () => {
  const source = readSource<Record<string, QuestPrerequisiteSource>>('quest_prerequisites.json')
  const { requires, fromOwnPage, unlisted } = QUEST_PREREQUISITES
  const known = knownQuests()

  it('records where every entry came from: the wiki’s module, or the quest’s own page', () => {
    const entries = Object.entries(source)
    expect(entries.filter(([, entry]) => !entry.src.trim()).map(([name]) => name)).toEqual([])
    const fromModule = entries.filter(([, entry]) => entry.src === QUEST_PREREQUISITE_MODULE)
    expect(fromModule).toHaveLength(213)
    // an entry read from a quest's page names that page
    expect(
      entries
        .filter(([, entry]) => entry.src !== QUEST_PREREQUISITE_MODULE)
        .filter(([name, entry]) => entry.src !== name)
        .map(([name]) => name),
    ).toEqual([])
  })

  it('has an entry for every quest the app knows', () => {
    // A quest that turns up here is new to the app's data and in neither source yet: read what
    // it requires from its wiki page and add it to datasrc/quest_prerequisites.json.
    expect(unlisted).toEqual([])
  })

  it('reads these quests from their own pages, because the wiki’s module has no entry for them', () => {
    // Pinned so that a refresh of the module shows what it has caught up with: a quest it now
    // lists should drop its hand-read entry, and this list with it.
    expect(fromOwnPage).toEqual([
      'A Ruff Situation',
      'Beneath Cursed Sands',
      'Crab Quest',
      'Current Affairs',
      'Fallen From Grace',
      'Land of the Goblins',
      'Pandemonium',
      'Prying Times',
      'Scrambled!',
      'Shadows of Custodia',
      'Sleeping Giants',
      'The Blood Moon Rises',
      'The Final Dawn',
      'The Ides of Milk',
      'The Red Reef',
      'Troubled Tortugans',
      'Vale Totems',
    ])
  })

  it('knows what 120 of the 190 quests require, and that the other 70 require none the app tracks', () => {
    expect(known).toHaveLength(190)
    expect(requires.size).toBe(120)
  })

  it('only ever names quests the app knows, each once, in name order', () => {
    for (const [quest, required] of requires) {
      expect(known, quest).toContain(quest)
      expect(
        required.filter((name) => !known.includes(name)),
        quest,
      ).toEqual([])
      expect(duplicates(required), quest).toEqual([])
      expect(required, quest).toEqual([...required].sort())
      expect(required.length, quest).toBeGreaterThan(0)
    }
  })

  it('has no quest that requires itself, however long the chain', () => {
    expect(known.filter((quest) => questPrerequisites(quest).includes(quest))).toEqual([])
  })

  it('keeps only full completions: nothing that is merely started, no template, no diary', () => {
    const everyName = [...requires.keys(), ...[...requires.values()].flat()]
    expect(
      everyName.filter((name) => /^Started:|subquest|Name_of_quest|Diary$/.test(name)),
    ).toEqual([])
    // Rag and Bone Man II only needs these three started, so finishing it says nothing about them
    expect(source['Rag and Bone Man II']?.requires).toContain('Started:Waterfall Quest')
    expect(questPrerequisites('Rag and Bone Man II')).not.toContain('Waterfall Quest')
  })

  it('reads the names the wiki writes differently', () => {
    // an escaped apostrophe in the Lua, a stray space, and the Recipe for Disaster subquests
    expect(requires.get("King's Ransom")).toEqual([
      'Holy Grail',
      'Murder Mystery',
      'One Small Favour',
    ])
    expect(questDependants('Watchtower')).not.toEqual([])
    expect(requires.get('Recipe for Disaster - King Awowogei')).toEqual([
      "Cook's Assistant",
      'Monkey Madness I',
    ])
  })

  it('follows a chain through a quest the app does not track', () => {
    // Desert Treasure I needs Troll Stronghold, which pays no XP and gates nothing; that needs Death Plateau
    expect(known).not.toContain('Troll Stronghold')
    expect(requires.get('Desert Treasure I')).toContain('Death Plateau')
    // the whole of Recipe for Disaster is every subquest, through its last one
    expect(questPrerequisites('Recipe for Disaster')).toEqual(
      expect.arrayContaining([
        'Recipe for Disaster - Evil Dave',
        'Desert Treasure I',
        'Death Plateau',
      ]),
    )
  })

  it('makes Dragon Slayer II the longest chain among the quests that gate something', () => {
    const gating = gatingQuests()
    const gatingBehind = (quest: string) =>
      questPrerequisites(quest).filter((required) => gating.includes(required))
    const longest = [...gating].sort(
      (first, second) => gatingBehind(second).length - gatingBehind(first).length,
    )[0]
    expect(longest).toBe('Dragon Slayer II')
    expect(gatingBehind('Dragon Slayer II')).toEqual([
      'Bone Voyage',
      'Dream Mentor',
      'Druidic Ritual',
      'Family Crest',
      "Icthlarin's Little Helper",
      'Lost City',
      'Lunar Diplomacy',
      'Priest in Peril',
      'Shilo Village',
      'The Fremennik Trials',
    ])
  })
})

describe('wildcards', () => {
  it('gives every wildcard a name of its own', () => {
    expect(duplicates(WILDCARDS.map((wildcard) => wildcard.name))).toEqual([])
  })

  it('always has one that needs nothing, so a new account can be dealt one', () => {
    const open = WILDCARDS.filter(
      ({ requirements }) =>
        !requirements.quests.length &&
        !requirements.skills.length &&
        !requirements.diaries.length &&
        !requirements.combatLevel,
    )
    expect(open.length).toBeGreaterThan(0)
  })
})

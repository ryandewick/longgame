/*
 * The checks the vanilla app's build ran over datasrc/ before it would write anything, kept as
 * tests, plus the assumptions the rules make about the data. A failure here means a source file
 * needs fixing, not the code.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Method } from '#shared/types/method'
import type { QuestFacts } from '#shared/types/quest'
import type { Requirements } from '#shared/types/requirement'
import { DIARY_FACTS } from '#shared/data/diary-facts'
import { METHODS } from '#shared/data/methods'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import { QUESTS } from '#shared/data/quests'
import { RESETS } from '#shared/data/resets'
import { SKILL_KEYS, SKILLS, isSkillKey } from '#shared/data/skills'
import type { LampSource, MethodSourceFile, ResetSource } from '#shared/data/sources'
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

  it('marks the methods done in the Wilderness, so every place that names one can say so', () => {
    // `wild` in a source entry: the tables tag the method, the skill page and a dealt block say it.
    // A method that only mentions the Wilderness (chins caught there, an altar "without Wilderness
    // risk") is not done in it. A new one here should be a decision, not an accident.
    expect(allMethods.filter((method) => method.inWilderness).map(whereIs)).toEqual([
      'prayer / Chaos altar, dragon bones',
      'prayer / Chaos altar, superior dragon bones',
      'magic / Barraging Wilderness bandits',
      'agility / Wilderness Agility Course',
      "thieving / Rogues' Castle chests",
      'slayer / Krystilia (Wilderness)',
      'hunter / Black salamanders',
    ])
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
      'smithing iron 1-3',
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

  it('has levels for every lamp quest whose table lists some', () => {
    // The lamp table's levels are not read, so a quest it brings in has none until its facts list
    // the ones its own page gives. Dream Mentor's page lists none: the table's eight are those of the
    // quests it requires, Lunar Diplomacy and Shilo Village.
    const levelsOf = new Map(QUESTS.map((quest) => [quest.name, quest.skillLevelsNeeded]))
    const listsLevels = (lamp: LampSource): boolean =>
      [...(lamp.requirements ?? '').matchAll(/SCP\('(\w+)',\s*'\d+'\)/g)].some(([, skill = '']) =>
        isSkillKey(skill.toLowerCase()),
      )
    const withoutLevels = readSource<LampSource[]>('quests_lamps.json')
      .filter(listsLevels)
      .map((lamp) => lamp.name.replaceAll("\\'", "'"))
      .filter((name) => Object.keys(levelsOf.get(name) ?? {}).length === 0)
    expect(withoutLevels).toEqual(['Dream Mentor'])
  })
})

describe('quest facts', () => {
  const known = knownQuests()
  const named = (quests: readonly QuestFacts[]) => quests.map((quest) => quest.name)

  it('holds the game’s whole quest list and the two activities', () => {
    // 184 quests, Recipe for Disaster's 10 parts and 20 miniquests: the game's list as RuneLite
    // reads it from the game cache, and the wiki's lists, on 22 October 2026
    const kinds = new Map<string, number>()
    for (const quest of QUEST_FACTS) kinds.set(quest.kind, (kinds.get(quest.kind) ?? 0) + 1)
    expect(Object.fromEntries(kinds)).toEqual({
      quest: 184,
      subquest: 10,
      miniquest: 20,
      activity: 2,
    })
    expect(named(QUEST_FACTS.filter((quest) => quest.kind === 'activity'))).toEqual([
      'Knight Waves Training Grounds',
      'Natural history quiz',
    ])
  })

  it('names every entry as a tick is stored: straight apostrophes, each once, in code-point order', () => {
    const names = named(QUEST_FACTS)
    expect(duplicates(names)).toEqual([])
    expect(names).toEqual([...names].sort())
    expect(names.filter((name) => name.includes('’') || name !== name.trim())).toEqual([])
  })

  it('records the wiki page and the revision every entry was read from', () => {
    expect(
      named(QUEST_FACTS.filter((quest) => !quest.page.trim() || !(quest.revision > 0))),
    ).toEqual([])
  })

  it('has every quest that pays XP and every quest a method, a reset or a wildcard asks for', () => {
    expect(QUESTS.map((quest) => quest.name).filter((name) => !known.includes(name))).toEqual([])
    expect(gatingQuests().filter((name) => !known.includes(name))).toEqual([])
  })

  it('counts Learning the Ropes, and nothing else, as done by every account', () => {
    expect(named(QUEST_FACTS.filter((quest) => quest.doneByEveryAccount))).toEqual([
      'Learning the Ropes',
    ])
  })

  it('marks as optional the 11 miniquests no quest and no diary task needs', () => {
    const optional = QUEST_FACTS.filter((quest) => quest.optional)
    expect(optional.every((quest) => quest.kind === 'miniquest')).toBe(true)
    expect(named(optional)).toEqual([
      'Bear Your Soul',
      "Daddy's Home",
      'Family Pest',
      "Hopespear's Will",
      'In Search of Knowledge',
      'Into the Tombs',
      'Mage Arena II',
      'The Enchanted Key',
      'The Fractured Archive',
      'The Frozen Door',
      'Vale Totems',
    ])
  })

  it('adds the Varrock Museum’s lamps to the four quests the lamp table has none for', () => {
    expect(
      QUEST_FACTS.filter((quest) => quest.lamps).map((quest) => [quest.name, quest.lamps?.totalXp]),
    ).toEqual([
      ['Defender of Varrock', 5000],
      ['Making History', 1000],
      ["Merlin's Crystal", 1000],
      ['Shield of Arrav', 1000],
    ])
  })

  it('chains every quest with a Herblore level to Druidic Ritual, which is what opens Herblore', () => {
    expect(
      named(
        QUEST_FACTS.filter(
          (quest) =>
            quest.name !== 'Druidic Ritual' &&
            quest.levels.herblore &&
            !questPrerequisites(quest.name).includes('Druidic Ritual'),
        ),
      ),
    ).toEqual([])
  })

  it('has no quest that requires itself, however long the chain', () => {
    expect(known.filter((quest) => questPrerequisites(quest).includes(quest))).toEqual([])
  })

  it('keeps the chains the research settled against Module:Questreq/data', () => {
    // only started, so finishing the later quest says nothing about it
    expect(questPrerequisites('Creature of Fenkenstrain')).not.toContain('The Restless Ghost')
    expect(questPrerequisites('Curse of the Empty Lord')).toEqual([])
    // finished, which the module had marked as only started
    expect(questPrerequisites('Wanted!')).toContain('Enter the Abyss')
    // no longer required since the page's edit of 8 August 2026
    expect(questPrerequisites('Rag and Bone Man II')).not.toContain('Horror from the Deep')
    expect(questPrerequisites('Rag and Bone Man II')).not.toContain('The Fremennik Trials')
    // Architectural Alliance went with Kourend favour on 10 January 2024
    expect(known).not.toContain('Architectural Alliance')
  })

  it('follows chains through quests that gate nothing, which the app now knows', () => {
    // Desert Treasure I needs Troll Stronghold, which needs Death Plateau
    expect(questPrerequisites('Desert Treasure I')).toEqual(
      expect.arrayContaining(['Troll Stronghold', 'Death Plateau']),
    )
    // Enter the Abyss proves Rune Mysteries
    expect(questPrerequisites('Enter the Abyss')).toEqual(['Rune Mysteries'])
    // the whole of Recipe for Disaster is every part, through its last one
    expect(questPrerequisites('Recipe for Disaster')).toEqual(
      expect.arrayContaining([
        "Recipe for Disaster - Another Cook's Quest",
        'Recipe for Disaster - Culinaromancer',
        'Desert Treasure I',
        'Death Plateau',
      ]),
    )
    expect(questDependants('Watchtower')).not.toEqual([])
  })

  it('keeps the quests needed only started apart from the chains, as the research reads the pages', () => {
    const started = QUEST_FACTS.filter((quest) => quest.requiresStarted.length).map((quest) => [
      quest.name,
      quest.requiresStarted,
    ])
    expect(started).toEqual([
      ['Creature of Fenkenstrain', ['The Restless Ghost']],
      ['Curse of the Empty Lord', ['Desert Treasure I', 'The Restless Ghost']],
      ['Dragon Slayer II', ['Barbarian Training']],
      ["Hopespear's Will", ['The Restless Ghost']],
      ['Rag and Bone Man II', ['Creature of Fenkenstrain']],
      ['Ratcatchers', ['The Giant Dwarf']],
      ['Recipe for Disaster - Sir Amik Varze', ["Legends' Quest"]],
    ])
  })

  it('marks the 30 quests something needs only started, so they can be ticked as started', () => {
    expect(QUEST_FACTS.filter((quest) => quest.startedMatters)).toHaveLength(30)
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

describe('diary facts', () => {
  it('holds the 48 tiers, region by region and easiest first, with the page each was read from', () => {
    expect(DIARY_FACTS).toHaveLength(48)
    expect(DIARY_FACTS.slice(0, 4).map((diary) => diary.name)).toEqual([
      'Ardougne Easy',
      'Ardougne Medium',
      'Ardougne Hard',
      'Ardougne Elite',
    ])
    expect(DIARY_FACTS.filter((diary) => !diary.page.trim() || !(diary.revision > 0))).toEqual([])
  })

  it('names 153 quests the tiers’ tasks need, 37 of them only started', () => {
    const needs = DIARY_FACTS.flatMap((diary) => Object.values(diary.quests))
    expect(needs).toHaveLength(153)
    expect(needs.filter((state) => state === 'started')).toHaveLength(37)
  })

  it('needs Fairytale II started for the five Medium tiers with a fairy ring task', () => {
    expect(
      DIARY_FACTS.filter((diary) => diary.quests['Fairytale II - Cure a Queen']).map((diary) => [
        diary.name,
        diary.quests['Fairytale II - Cure a Queen'],
      ]),
    ).toEqual([
      ['Ardougne Medium', 'started'],
      ['Fremennik Medium', 'started'],
      ['Kandarin Medium', 'started'],
      ['Kourend & Kebos Medium', 'started'],
      ['Lumbridge & Draynor Medium', 'started'],
    ])
  })

  it('reads a quest as its tier’s page does where the page says partial completion is enough', () => {
    // Quest Helper and RuneLite ask for these finished; a claimed tier proves at least started
    const quests = (name: string) => DIARY_FACTS.find((diary) => diary.name === name)?.quests
    expect(quests('Desert Hard')).toMatchObject({ 'Contact!': 'started', 'The Feud': 'started' })
    expect(quests('Fremennik Hard')).toMatchObject({
      'The Fremennik Isles': 'started',
      'Throne of Miscellania': 'started',
    })
    expect(quests('Kourend & Kebos Medium')).toMatchObject({ "Eagles' Peak": 'started' })
    expect(quests('Morytania Elite')).toMatchObject({ 'In Aid of the Myreque': 'started' })
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

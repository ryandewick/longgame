import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Account } from '#shared/types/account'
import type { SkillKey } from '#shared/types/skill'
import { QUESTS } from '#shared/data/quests'
import { maxProgress } from '#shared/domain/estimates'
import {
  askCarriersFirst,
  changesThePlan,
  gatedActivities,
  planQuestions,
  savesHours,
  withRequirementDone,
  type PlanQuestion,
  type PlanQuestions,
  type PlanRequirement,
  type RequirementEffect,
} from '#shared/domain/plan-questions'
import { questDependants, questPrerequisites } from '#shared/domain/quest-chains'
import {
  declineDiary,
  declineQuest,
  tickDiary,
  tickQuest,
  type QuestTicks,
} from '#shared/domain/quest-ticks'
import { gatingDiaries, gatingQuests, questLevelsShort } from '#shared/domain/quests'
import { accountFromSave, migrateLegacySave, type LegacySaveV1 } from '#shared/domain/save'
import { xpForLevel } from '#shared/domain/xp'

/*
 * These run on the fixture account (tests/fixtures/account.json), as an ironman.
 * Its own ticks are taken as the truth about what it has done; the questions are put to the
 * same account with nothing ticked, the way a new player's account arrives from the hiscores.
 */
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { state: LegacySaveV1 }

const truth: Account = { ...accountFromSave(migrateLegacySave(fixture.state)), type: 'iron' }
const unticked: Account = { ...truth, completedQuests: new Set(), completedDiaries: new Set() }

const NOTHING_TICKED: QuestTicks = {
  completedQuests: [],
  completedDiaries: [],
  declinedQuests: [],
  declinedDiaries: [],
}

const quest = (name: string): PlanRequirement => ({ kind: 'quest', name })
const diary = (name: string): PlanRequirement => ({ kind: 'diary', name })

/** Both rounds as one list: the questions that save hours, then the smaller ones. */
const everyQuestion = (plan: PlanQuestions): PlanQuestion[] => [
  ...plan.savingHours,
  ...plan.smaller,
]

const namesAsked = (questions: readonly PlanQuestion[]): string[] =>
  questions.map((question) => question.requirement.name)

function questionAbout(account: Account, name: string, ticks = NOTHING_TICKED): PlanQuestion {
  const question = everyQuestion(planQuestions(account, ticks)).find(
    (candidate) => candidate.requirement.name === name,
  )
  if (!question) throw new Error(`${name} is not asked about`)
  return question
}

const withTicks = (ticks: QuestTicks): Account => ({
  ...unticked,
  completedQuests: new Set(ticks.completedQuests),
  completedDiaries: new Set(ticks.completedDiaries),
})

const withLevels = (account: Account, levels: Partial<Record<SkillKey, number>>): Account => ({
  ...account,
  skills: {
    ...account.skills,
    ...Object.fromEntries(
      Object.entries(levels).map(([skill, level]) => [skill, { level, xp: xpForLevel(level) }]),
    ),
  },
})

/** Puts the first question, answers it as the fixture's own ticks say, and goes round again until none is left. */
function answerTruthfully(isWorthAsking?: (effect: RequirementEffect) => boolean) {
  let ticks = NOTHING_TICKED
  const asked: PlanQuestion[] = []
  for (;;) {
    const [question] = everyQuestion(planQuestions(withTicks(ticks), ticks, isWorthAsking))
    if (!question) return { asked, ticks, account: withTicks(ticks) }
    asked.push(question)
    const { kind, name } = question.requirement
    if (kind === 'quest') {
      ticks = truth.completedQuests.has(name)
        ? tickQuest(ticks, name).ticks
        : declineQuest(ticks, name)
    } else {
      ticks = truth.completedDiaries.has(name) ? tickDiary(ticks, name) : declineDiary(ticks, name)
    }
  }
}

const effectWith = (overrides: Partial<RequirementEffect> = {}): RequirementEffect => ({
  hoursSaved: 0,
  skillsChanged: [],
  resetsOpened: [],
  methodsOpened: [],
  opens: [],
  ...overrides,
})

describe('savesHours and changesThePlan', () => {
  it('count a saving from half an hour up', () => {
    expect(savesHours(effectWith({ hoursSaved: 0.49 }))).toBe(false)
    expect(savesHours(effectWith({ hoursSaved: 0.5 }))).toBe(true)
    expect(changesThePlan(effectWith({ hoursSaved: 0.5 }))).toBe(true)
  })

  it('count a block that would be dealt differently, or a reset that would open, without any hours', () => {
    expect(changesThePlan(effectWith())).toBe(false)
    expect(changesThePlan(effectWith({ skillsChanged: ['agility'] }))).toBe(true)
    expect(changesThePlan(effectWith({ resetsOpened: ['Tears of Guthix'] }))).toBe(true)
    expect(savesHours(effectWith({ skillsChanged: ['agility'], resetsOpened: ['Herb run'] }))).toBe(
      false,
    )
  })
})

describe('withRequirementDone', () => {
  it('ticks a quest together with every quest it requires', () => {
    const after = withRequirementDone(unticked, quest('Underground Pass'))
    expect([...after.completedQuests].sort()).toEqual([
      'Biohazard',
      'Plague City',
      'Underground Pass',
    ])
    expect(unticked.completedQuests.size).toBe(0)
  })

  it('ticks a diary tier by itself', () => {
    const after = withRequirementDone(unticked, diary('Ardougne Hard'))
    expect([...after.completedDiaries]).toEqual(['Ardougne Hard'])
    expect(after.completedQuests.size).toBe(0)
  })
})

describe('planQuestions: what can be asked about', () => {
  const plan = planQuestions(unticked, NOTHING_TICKED)
  const questions = everyQuestion(plan)
  const { setAsideCount } = plan

  it('asks only about quests and diary tiers that a method, a reset or a wildcard requires', () => {
    for (const { requirement } of questions) {
      const gating = requirement.kind === 'quest' ? gatingQuests() : gatingDiaries()
      expect(gating, requirement.name).toContain(requirement.name)
    }
  })

  it('counts the open requirements it does not ask about', () => {
    // 39 quests and 11 diary tiers gate something; with nothing ticked 34 are worth a question
    expect(gatingQuests().length + gatingDiaries().length).toBe(50)
    expect(questions).toHaveLength(34)
    expect(setAsideCount).toBe(16)
  })

  it('does not ask about what is ticked', () => {
    const account = withRequirementDone(
      withRequirementDone(unticked, quest('Bone Voyage')),
      diary('Kandarin Easy'),
    )
    const asked = namesAsked(everyQuestion(planQuestions(account, NOTHING_TICKED)))
    expect(asked).not.toContain('Bone Voyage')
    expect(asked).not.toContain('Druidic Ritual')
    expect(asked).not.toContain('Kandarin Easy')
    expect(asked).toContain('Sins of the Father')
  })

  it('does not ask again about what was answered "not yet"', () => {
    // nothing requires Tears of Guthix, so these two answers rule nothing else out
    const ticks = declineDiary(declineQuest(NOTHING_TICKED, 'Tears of Guthix'), 'Kandarin Easy')
    const plan = planQuestions(unticked, ticks)
    expect(namesAsked(everyQuestion(plan))).not.toContain('Tears of Guthix')
    expect(namesAsked(everyQuestion(plan))).not.toContain('Kandarin Easy')
    // an answer is not something set aside
    expect(everyQuestion(plan).length + plan.setAsideCount).toBe(48)
  })

  it('does not ask about a quest that requires one answered "not yet"', () => {
    const ticks = declineQuest(NOTHING_TICKED, 'Children of the Sun')
    const dependants = questDependants('Children of the Sun')
    expect(dependants).toEqual(
      expect.arrayContaining(['Perilous Moons', 'The Heart of Darkness', 'Vale Totems']),
    )
    expect(namesAsked(questions)).toEqual(
      expect.arrayContaining(['Perilous Moons', 'The Heart of Darkness', 'Vale Totems']),
    )

    const plan = planQuestions(unticked, ticks)
    expect(namesAsked(everyQuestion(plan)).filter((name) => dependants.includes(name))).toEqual([])
    // ruled out is not set aside either: the count is of quests that could still become questions
    const ruledOut = gatingQuests().filter((name) => dependants.includes(name))
    expect(everyQuestion(plan).length + plan.setAsideCount).toBe(50 - 1 - ruledOut.length)
  })

  it('asks about nothing a shortcut already covers', () => {
    const questCape = everyQuestion(planQuestions({ ...unticked, allQuests: true }, NOTHING_TICKED))
    expect(questCape.filter(({ requirement }) => requirement.kind === 'quest')).toEqual([])
    expect(questCape.length).toBeGreaterThan(0)

    const everyDiary = everyQuestion(
      planQuestions({ ...unticked, allDiaries: true }, NOTHING_TICKED),
    )
    expect(everyDiary.filter(({ requirement }) => requirement.kind === 'diary')).toEqual([])

    const both = planQuestions({ ...unticked, allQuests: true, allDiaries: true }, NOTHING_TICKED)
    expect(both).toEqual({ savingHours: [], smaller: [], setAsideCount: 0 })
  })

  const levelsShort = (account: Account, name: string) => {
    const known = QUESTS.find((candidate) => candidate.name === name)
    return known ? questLevelsShort(account, known) : []
  }

  it('never asks about a quest the account’s levels say it cannot have finished', () => {
    // Monkey Madness II would save more hours than most, but needs 60 Hunter and 69 Slayer
    const short = levelsShort(unticked, 'Monkey Madness II')
    expect(short.length).toBeGreaterThan(0)
    expect(namesAsked(questions)).not.toContain('Monkey Madness II')

    const chain = ['Monkey Madness II', ...questPrerequisites('Monkey Madness II')]
    const trained = withLevels(
      unticked,
      Object.fromEntries(
        chain
          .flatMap((link) => levelsShort(unticked, link))
          .map(({ skill, level }) => [skill, level]),
      ),
    )
    expect(namesAsked(everyQuestion(planQuestions(trained, NOTHING_TICKED)))).toContain(
      'Monkey Madness II',
    )
  })

  it('never asks about a quest when a quest on the way to it needs levels the account lacks', () => {
    // the data lists no levels for Bone Voyage, but The Dig Site before it needs 10 Herblore
    const untrained = withLevels(unticked, { herblore: 5 })
    expect(levelsShort(untrained, 'Bone Voyage')).toEqual([])
    expect(levelsShort(untrained, 'The Dig Site')).toEqual([{ skill: 'herblore', level: 10 }])
    expect(questPrerequisites('Bone Voyage')).toContain('The Dig Site')

    expect(namesAsked(questions)).toContain('Bone Voyage')
    expect(namesAsked(everyQuestion(planQuestions(untrained, NOTHING_TICKED)))).not.toContain(
      'Bone Voyage',
    )
  })

  it('holds every question it does ask to that rule', () => {
    for (const { requirement } of questions) {
      if (requirement.kind !== 'quest') continue
      for (const link of [requirement.name, ...questPrerequisites(requirement.name)]) {
        expect(levelsShort(unticked, link), `${requirement.name}: ${link}`).toEqual([])
      }
    }
  })
})

describe('planQuestions: what a question carries', () => {
  const questions = everyQuestion(planQuestions(unticked, NOTHING_TICKED))

  it('takes its hours from the estimates: the hours to max before, less the hours with it done', () => {
    const hoursNow = maxProgress(unticked).hoursLeft
    for (const question of questions) {
      const after = withRequirementDone(unticked, question.requirement)
      expect(question.hoursSaved, question.requirement.name).toBeCloseTo(
        hoursNow - maxProgress(after).hoursLeft,
        6,
      )
      expect(question.hoursSaved).toBeGreaterThanOrEqual(0)
    }
  })

  it('counts what the quests it requires unlock: one yes settles the whole chain', () => {
    // Bone Voyage needs The Dig Site, which needs Druidic Ritual, which opens Herblore
    expect(questPrerequisites('Bone Voyage')).toEqual(['Druidic Ritual', 'The Dig Site'])
    const alone = questionAbout(unticked, 'Druidic Ritual').hoursSaved
    const withChain = questionAbout(unticked, 'Bone Voyage').hoursSaved
    const onItsOwn = questionAbout(
      withRequirementDone(unticked, quest('Druidic Ritual')),
      'Bone Voyage',
    ).hoursSaved
    expect(alone).toBeCloseTo(290.6, 1)
    expect(withChain).toBeCloseTo(364.6, 1)
    expect(onItsOwn).toBeLessThan(withChain - alone + 1)
    expect(questionAbout(unticked, 'Bone Voyage').skillsChanged).toContain('herblore')
  })

  it('names the skills whose AFK, semi-AFK or active block would be dealt a different method', () => {
    // no hours saved, but Karambwan becomes what a Cooking or Fishing block is dealt
    const account = withRequirementDone(unticked, quest('Druidic Ritual'))
    const question = questionAbout(account, 'Tai Bwo Wannai Trio')
    expect(question.hoursSaved).toBeLessThan(0.5)
    expect(question.skillsChanged).toEqual(['cooking', 'fishing'])
    // and the method is named once, with both of the skills it trains
    expect(question.methodsOpened).toEqual([{ name: 'Karambwan', skills: ['cooking', 'fishing'] }])
  })

  it('leaves a skill the player keeps out of sessions out of the block changes', () => {
    const account: Account = {
      ...withRequirementDone(unticked, quest('Druidic Ritual')),
      preferences: { ...unticked.preferences, excludedSkills: new Set(['cooking']) },
    }
    expect(questionAbout(account, 'Tai Bwo Wannai Trio').skillsChanged).toEqual(['fishing'])
  })

  it('names the timed runs and dailies that would open', () => {
    expect(questionAbout(unticked, 'Tears of Guthix')).toMatchObject({
      hoursSaved: 0,
      skillsChanged: [],
      resetsOpened: ['Tears of Guthix'],
      opens: ['Tears of Guthix'],
    })
    expect(questionAbout(unticked, 'Ardougne Medium').resetsOpened).toEqual([
      'Pure essence from Cromperty',
    ])
    expect(questionAbout(unticked, 'Bone Voyage').resetsOpened).toEqual([
      'Birdhouse run',
      'Giant seaweed',
      'Hardwood trees',
    ])
  })

  it('says what it opens up, each activity once whatever style it is done in', () => {
    const account = withRequirementDone(unticked, quest('Druidic Ritual'))
    const { opens } = questionAbout(account, 'Sins of the Father')
    // 'Hallowed Sepulchre looting coffins' is the same place; the Sentinels train three skills
    expect(opens.filter((name) => name.startsWith('Hallowed Sepulchre'))).toEqual([
      'Hallowed Sepulchre',
    ])
    expect(opens.filter((name) => name === 'Vyrewatch Sentinels')).toHaveLength(1)
    expect(opens).toContain('Blisterwood tree')

    // the Gemstone Crab is a method of four skills, with a weapon named in two of them
    const crab = questionAbout(account, 'Children of the Sun').opens
    expect(crab.filter((name) => name.startsWith('Gemstone Crab'))).toEqual(['Gemstone Crab'])
  })

  it('names the methods it opens with the skills each trains, and lists them before the resets', () => {
    const account = withRequirementDone(unticked, quest('Druidic Ritual'))
    const sins = questionAbout(account, 'Sins of the Father')
    const sepulchre = sins.methodsOpened.find((method) => method.name === 'Hallowed Sepulchre')
    expect(sepulchre?.skills).toEqual(['agility'])
    expect(
      sins.methodsOpened.find((method) => method.name === 'Vyrewatch Sentinels')?.skills,
    ).toEqual(['attack', 'defence', 'strength'])

    const throne = questionAbout(account, 'Throne of Miscellania')
    expect(throne.opens).toEqual([
      ...throne.methodsOpened.map((method) => method.name),
      ...throne.resetsOpened,
    ])
    expect(throne.resetsOpened).toEqual(['Kingdom of Miscellania'])
  })

  it('opens only what the requirement is the last thing in the way of', () => {
    // Guardians of the Rift is behind Temple of the Eye alone; every question opens something
    expect(questionAbout(unticked, 'Temple of the Eye').opens).toEqual(['Guardians of the Rift'])
    for (const question of questions) {
      expect(question.opens.length, question.requirement.name).toBeGreaterThan(0)
    }
  })

  it('never opens a method that needs the Grand Exchange for an ironman', () => {
    const main: Account = { ...unticked, type: 'main' }
    expect(questionAbout(main, 'Family Crest').opens).toEqual(['Blast Furnace gold bars'])
    expect(questionAbout(unticked, 'Family Crest').opens).toEqual([
      "Blast Furnace gold (Ordan's ore)",
    ])
  })
})

describe('askCarriersFirst', () => {
  // Finale requires Middle, which requires Start; Other stands alone
  const chain: Record<string, string[]> = {
    Finale: ['Middle', 'Start'],
    Middle: ['Start'],
  }
  const prerequisitesOf = (name: string): string[] => chain[name] ?? []
  const saving = (requirement: PlanRequirement, hoursSaved: number): PlanQuestion => ({
    requirement,
    ...effectWith({ hoursSaved }),
  })
  const reordered = (...questions: PlanQuestion[]): string[] =>
    namesAsked(askCarriersFirst(questions, prerequisitesOf))

  it('moves a prerequisite that carries at least half of a quest’s saving to just before it', () => {
    expect(
      reordered(
        saving(quest('Middle'), 100),
        saving(quest('Other'), 80),
        saving(quest('Start'), 50),
      ),
    ).toEqual(['Start', 'Middle', 'Other'])
  })

  it('leaves a prerequisite that carries less than half where the sort put it', () => {
    expect(
      reordered(
        saving(quest('Middle'), 100),
        saving(quest('Other'), 80),
        saving(quest('Start'), 49),
      ),
    ).toEqual(['Middle', 'Other', 'Start'])
  })

  it('carries a chain of three forward together, the earliest quest first', () => {
    expect(
      reordered(
        saving(quest('Finale'), 150),
        saving(quest('Other'), 130),
        saving(quest('Middle'), 120),
        saving(quest('Start'), 100),
      ),
    ).toEqual(['Start', 'Middle', 'Finale', 'Other'])
  })

  it('applies the same test to the question it moved', () => {
    // Middle carries Finale; Start carries Middle but not Finale, and still goes first
    expect(
      reordered(
        saving(quest('Finale'), 200),
        saving(quest('Middle'), 110),
        saving(quest('Start'), 60),
      ),
    ).toEqual(['Start', 'Middle', 'Finale'])
  })

  it('keeps the order given among questions it has no reason to move', () => {
    expect(
      reordered(
        saving(quest('Other'), 90),
        saving(quest('Start'), 80),
        saving(quest('Middle'), 70),
      ),
    ).toEqual(['Other', 'Start', 'Middle'])
  })

  it('never moves a question that saves no hours, and never moves one for it', () => {
    expect(
      reordered(
        saving(quest('Middle'), 0.6),
        saving(quest('Other'), 0.5),
        saving(quest('Start'), 0.4),
      ),
    ).toEqual(['Middle', 'Other', 'Start'])
    expect(
      reordered(saving(quest('Middle'), 0), saving(quest('Other'), 0), saving(quest('Start'), 0)),
    ).toEqual(['Middle', 'Other', 'Start'])
  })

  it('has no chains to follow for a diary tier, whatever it is called', () => {
    expect(
      reordered(
        saving(diary('Middle'), 100),
        saving(quest('Other'), 80),
        saving(quest('Start'), 90),
      ),
    ).toEqual(['Middle', 'Other', 'Start'])
    expect(
      reordered(
        saving(quest('Middle'), 100),
        saving(quest('Other'), 80),
        saving(diary('Start'), 90),
      ),
    ).toEqual(['Middle', 'Other', 'Start'])
  })

  it('reads the wiki’s chains when it is given none', () => {
    expect(
      namesAsked(
        askCarriersFirst([saving(quest('Biohazard'), 10), saving(quest('Plague City'), 6)]),
      ),
    ).toEqual(['Plague City', 'Biohazard'])
  })
})

describe('planQuestions: the two rounds', () => {
  const plan = planQuestions(unticked, NOTHING_TICKED)

  it('asks the questions that save hours first, and keeps the smaller ones for a second round', () => {
    expect(plan.savingHours.every(savesHours)).toBe(true)
    expect(plan.smaller.some(savesHours)).toBe(false)
    expect(plan.savingHours).toHaveLength(23)
    expect(plan.smaller).toHaveLength(11)
  })

  it('makes every smaller question one that adds a reset or changes a block, with no question in both rounds', () => {
    for (const question of plan.smaller) {
      expect(
        question.resetsOpened.length + question.skillsChanged.length,
        question.requirement.name,
      ).toBeGreaterThan(0)
    }
    const asked = namesAsked(everyQuestion(plan))
    expect(new Set(asked).size).toBe(asked.length)
  })

  it('has no second round when only hours are asked about', () => {
    const hoursOnly = planQuestions(unticked, NOTHING_TICKED, savesHours)
    expect(hoursOnly.smaller).toEqual([])
    expect(namesAsked(hoursOnly.savingHours)).toEqual(namesAsked(plan.savingHours))
  })
})

describe('planQuestions: the order', () => {
  const plan = planQuestions(unticked, NOTHING_TICKED)
  const planChanges = (question: PlanQuestion) =>
    question.skillsChanged.length + question.resetsOpened.length
  const carries = (earlier: PlanQuestion, later: PlanQuestion): boolean =>
    earlier.requirement.kind === 'quest' &&
    later.requirement.kind === 'quest' &&
    questPrerequisites(later.requirement.name).includes(earlier.requirement.name) &&
    earlier.hoursSaved >= later.hoursSaved / 2

  it('asks the fixture account’s first round in this order, with nothing ticked', () => {
    expect(
      plan.savingHours.map(
        (question) => `${question.requirement.name} ${Math.round(question.hoursSaved)}`,
      ),
    ).toEqual([
      // Druidic Ritual opens Herblore: it is behind every 291 here, so it is asked before them
      'Druidic Ritual 291',
      'Bone Voyage 365',
      'Sins of the Father 351',
      'Shilo Village 291',
      'Lunar Diplomacy 308',
      'Dream Mentor 308',
      'Swan Song 302',
      "Shades of Mort'ton 301",
      'Desert Treasure I 291',
      'Tai Bwo Wannai Trio 291',
      'Throne of Miscellania 291',
      'A Kingdom Divided 291',
      // and Children of the Sun is behind the three that follow it
      'Children of the Sun 74',
      'Perilous Moons 106',
      'Vale Totems 79',
      'The Heart of Darkness 74',
      'Creature of Fenkenstrain 11',
      'Dwarf Cannon 8',
      'Fremennik Hard 6',
      'Family Crest 3',
      'Temple of the Eye 3',
      'Pandemonium 1',
      'Desert Hard 1',
    ])
  })

  it('asks the smaller questions in this order', () => {
    expect(namesAsked(plan.smaller)).toEqual([
      'Sleeping Giants',
      'The Tourist Trap',
      'Ardougne Medium',
      'Kandarin Easy',
      'Kandarin Hard',
      'Kourend & Kebos Medium',
      'Morytania Medium',
      'Tears of Guthix',
      'The Hand in the Sand',
      'Western Provinces Easy',
      'Wilderness Easy',
    ])
  })

  it('never asks a quest before one it requires that carries at least half of its saving', () => {
    plan.savingHours.forEach((later, place) => {
      for (const earlier of plan.savingHours.slice(place + 1)) {
        expect(
          carries(earlier, later),
          `${earlier.requirement.name} after ${later.requirement.name}`,
        ).toBe(false)
      }
    })
  })

  it('otherwise puts the biggest saving of hours first', () => {
    // a question out of plain order is always one that was moved in front of a quest it carries
    plan.savingHours.forEach((question, place) => {
      const after = plan.savingHours.slice(place + 1)
      const isOutOfOrder = after.some((later) => later.hoursSaved > question.hoursSaved)
      if (!isOutOfOrder) return
      expect(
        after.some((later) => carries(question, later)),
        question.requirement.name,
      ).toBe(true)
    })
    const smallerHours = plan.smaller.map((question) => question.hoursSaved)
    expect(smallerHours).toEqual([...smallerHours].sort((first, second) => second - first))
  })

  it('re-ranks the quests behind an answer on what they add themselves', () => {
    const account = withRequirementDone(unticked, quest('Druidic Ritual'))
    const afterRitual = planQuestions(account, NOTHING_TICKED)
    expect(
      afterRitual.savingHours
        .slice(0, 4)
        .map((question) => `${question.requirement.name} ${Math.round(question.hoursSaved)}`),
    ).toEqual([
      'Children of the Sun 74',
      'Perilous Moons 106',
      'Vale Totems 79',
      'The Heart of Darkness 74',
    ])
    // Bone Voyage showed 365 hours while the 291 of Druidic Ritual were counted in it
    expect(Math.round(questionAbout(account, 'Bone Voyage').hoursSaved)).toBe(74)
  })

  it('still rules out every quest behind a "not yet", wherever the order put it', () => {
    const declined = planQuestions(unticked, declineQuest(NOTHING_TICKED, 'Druidic Ritual'))
    const asked = namesAsked(everyQuestion(declined))
    expect(asked).not.toContain('Druidic Ritual')
    for (const dependant of [
      'Bone Voyage',
      'Sins of the Father',
      'Lunar Diplomacy',
      'Dream Mentor',
    ]) {
      expect(asked, dependant).not.toContain(dependant)
    }
    expect(asked[0]).toBe('Children of the Sun')
  })

  it('orders questions that save the same by how much of the plan they change, then by name', () => {
    let ties = 0
    plan.smaller.forEach((question, place) => {
      const next = plan.smaller[place + 1]
      if (!next || next.hoursSaved !== question.hoursSaved) return
      ties++
      const sameChanges = planChanges(question) === planChanges(next)
      expect(planChanges(question), question.requirement.name).toBeGreaterThanOrEqual(
        planChanges(next),
      )
      if (sameChanges) expect(question.requirement.name < next.requirement.name).toBe(true)
    })
    // the questions that save no hours at all are one long tie
    expect(ties).toBeGreaterThan(5)
  })

  it('comes out the same every time', () => {
    expect(planQuestions(unticked, NOTHING_TICKED)).toEqual(plan)
  })
})

describe('planQuestions: a whole run of answers', () => {
  it('takes the fixture account from 2,388 hours to 1,956 in the 11 questions of the first round', () => {
    const { asked, account } = answerTruthfully(savesHours)
    expect(Math.round(maxProgress(unticked).hoursLeft)).toBe(2388)
    expect(
      asked.map(
        ({ requirement, hoursSaved }) =>
          `${requirement.name} ${Math.round(hoursSaved)} ${truth.completedQuests.has(requirement.name) ? 'yes' : 'no'}`,
      ),
    ).toEqual([
      'Druidic Ritual 291 yes',
      'Children of the Sun 74 yes',
      'Sins of the Father 61 no',
      'Bone Voyage 45 yes',
      'Perilous Moons 32 no',
      'Lunar Diplomacy 17 no',
      'Creature of Fenkenstrain 11 yes',
      'Vale Totems 5 yes',
      'Family Crest 3 yes',
      'Temple of the Eye 3 yes',
      'Pandemonium 1 no',
    ])
    expect(Math.round(maxProgress(account).hoursLeft)).toBe(1956)
    // exactly what ticking everything the account has done gives
    expect(maxProgress(account).hoursLeft).toBeCloseTo(maxProgress(truth).hoursLeft, 6)
  })

  it('asks 27 questions if the player goes on through the second round: 11, then 16 smaller ones', () => {
    const { asked, account } = answerTruthfully()
    expect(asked).toHaveLength(27)
    expect(asked.filter(savesHours)).toHaveLength(11)
    // the first round is over before the second starts
    expect(asked.slice(0, 11).every(savesHours)).toBe(true)
    expect(maxProgress(account).hoursLeft).toBeCloseTo(maxProgress(truth).hoursLeft, 6)
  })

  it('ends with nothing ticked that is not true and nothing declined that is done', () => {
    const { ticks } = answerTruthfully()
    expect(ticks.completedQuests.filter((name) => !truth.completedQuests.has(name))).toEqual([])
    expect(ticks.completedDiaries.filter((name) => !truth.completedDiaries.has(name))).toEqual([])
    expect(ticks.declinedQuests.filter((name) => truth.completedQuests.has(name))).toEqual([])
    expect(ticks.declinedDiaries.filter((name) => truth.completedDiaries.has(name))).toEqual([])
  })

  it('settles more quests than it asks about, through the chains', () => {
    const { asked, ticks } = answerTruthfully()
    const yeses = asked.filter(
      ({ requirement }) =>
        requirement.kind === 'quest' && ticks.completedQuests.includes(requirement.name),
    )
    expect(ticks.completedQuests.length).toBeGreaterThan(yeses.length)
  })

  it('has nothing left to ask an account that has answered everything', () => {
    const { ticks, account } = answerTruthfully()
    expect(everyQuestion(planQuestions(account, ticks))).toEqual([])
  })
})

describe('gatedActivities', () => {
  it('lists what names the requirement: methods once each, then resets, then wildcards', () => {
    expect(gatedActivities(unticked, quest('Bone Voyage')).names).toEqual([
      'Teak trees (1.5-tick)',
      'Sulliusceps',
      'Drift net fishing',
      'Volcanic Mine',
      'Hardwood tree runs',
      'Bird house runs',
      'Herbiboar',
      'Birdhouse run',
      'Giant seaweed',
      'Hardwood trees',
    ])
    expect(gatedActivities(unticked, quest('Temple of the Eye')).names).toEqual([
      'Guardians of the Rift',
    ])
  })

  it('names the skills they train, in hiscores order', () => {
    expect(gatedActivities(unticked, quest('Bone Voyage')).skills).toEqual([
      'woodcutting',
      'fishing',
      'mining',
      'farming',
      'hunter',
    ])
    expect(gatedActivities(unticked, quest('Tears of Guthix'))).toEqual({
      names: ['Tears of Guthix'],
      skills: [],
    })
  })

  it('keeps to the methods for the account’s type', () => {
    const main: Account = { ...unticked, type: 'main' }
    expect(gatedActivities(main, quest('Family Crest')).names).toEqual(['Blast Furnace gold bars'])
    expect(gatedActivities(unticked, quest('Family Crest')).names).toEqual([
      "Blast Furnace gold (Ordan's ore)",
    ])
  })

  it('reads the same whether or not the account has done it', () => {
    expect(gatedActivities(truth, quest('Bone Voyage'))).toEqual(
      gatedActivities(unticked, quest('Bone Voyage')),
    )
  })

  it('covers diary tiers too', () => {
    expect(gatedActivities(unticked, diary('Ardougne Medium')).names).toEqual([
      'Pure essence from Cromperty',
    ])
  })
})

/* How datasrc/ entries become the app's data, and what the builders refuse. */
import { describe, expect, it } from 'vitest'
import type { QuestFacts } from '#shared/types/quest'
import { buildMethods } from '#shared/data/build-methods'
import { buildQuestFacts } from '#shared/data/build-quest-facts'
import { buildQuests } from '#shared/data/build-quests'
import { buildResets } from '#shared/data/build-resets'
import { DataSourceError } from '#shared/data/sources'
import type {
  FixedQuestXpSource,
  LampSource,
  MethodSource,
  QuestFactSource,
  ResetSource,
} from '#shared/data/sources'
import { NO_REQUIREMENTS } from '#shared/domain/requirements'

const methodSource = (overrides: Partial<MethodSource> = {}): MethodSource => ({
  lv: 1,
  name: 'Iron ore',
  who: 'both',
  int: 'active',
  cost: 'free',
  xph: 30_000,
  req: '',
  run: false,
  supply: false,
  note: 'Three rocks.',
  src: 'Mining training',
  ...overrides,
})

const problemsOf = (build: () => unknown): readonly string[] => {
  try {
    build()
  } catch (error) {
    if (error instanceof DataSourceError) return error.problems
    throw error
  }
  return []
}

describe('buildMethods', () => {
  const build = (...sources: Partial<MethodSource>[]) =>
    buildMethods('mining', sources.map(methodSource))

  it('turns a source entry into a method', () => {
    expect(build({ req: 'q:Bone Voyage;s:mining 1' })).toEqual([
      {
        skill: 'mining',
        level: 1,
        name: 'Iron ore',
        xpPerHour: 30_000,
        intensity: 'active',
        cost: 'free',
        requirements: {
          quests: ['Bone Voyage'],
          skills: [{ skill: 'mining', level: 1 }],
          diaries: [],
          combatLevel: 0,
        },
        note: 'Three rocks.',
        source: 'Mining training',
        audience: 'both',
        usesOwnSupplies: false,
        tickPerfect: false,
        questSkip: false,
        perTripSetup: false,
        inWilderness: false,
      },
    ])
  })

  it('tidies names and notes', () => {
    const [method] = build({ name: ' Iron ore ', note: '  Three   rocks.\n Bank at the chest. ' })
    expect(method?.name).toBe('Iron ore')
    expect(method?.note).toBe('Three rocks. Bank at the chest.')
  })

  it('carries the flags across', () => {
    const [method] = build({
      who: 'iron',
      supply: true,
      setup: true,
      wild: true,
      calc: 'crab-melee',
      xph: 0,
    })
    expect(method).toMatchObject({
      audience: 'iron',
      usesOwnSupplies: true,
      perTripSetup: true,
      inWilderness: true,
      computedRate: 'crab-melee',
    })
  })

  it('uses the miniquest’s plain name in requirements', () => {
    const [method] = build({ req: 'q:Vale Totems (miniquest)' })
    expect(method?.requirements).toEqual({ ...NO_REQUIREMENTS, quests: ['Vale Totems'] })
  })

  it('orders methods by level, then by the best rate they reach, then as the source has them', () => {
    const methods = build(
      { name: 'Late', lv: 30, xph: 10 },
      { name: 'Slow', lv: 1, xph: 10 },
      { name: 'Tied first', lv: 1, xph: 50 },
      { name: 'Tied second', lv: 1, xph: 50 },
      {
        name: 'Slow start, fast finish',
        lv: 1,
        xph: 0,
        bands: [
          [1, 5],
          [40, 900],
        ],
      },
    )
    expect(methods.map((method) => method.name)).toEqual([
      'Slow start, fast finish',
      'Tied first',
      'Tied second',
      'Slow',
      'Late',
    ])
  })

  describe('rate bands', () => {
    it('take the method’s own rate from the first band', () => {
      const [method] = build({
        lv: 15,
        xph: 1,
        bands: [
          [15, 20_000],
          [30, 35_000],
        ],
      })
      expect(method?.xpPerHour).toBe(20_000)
      expect(method?.rateBands).toEqual([
        { fromLevel: 15, xpPerHour: 20_000 },
        { fromLevel: 30, xpPerHour: 35_000 },
      ])
    })

    it('are dropped when there is only one, which says no more than a flat rate', () => {
      const [method] = build({ lv: 15, xph: 1, bands: [[15, 20_000]] })
      expect(method?.xpPerHour).toBe(20_000)
      expect(method).not.toHaveProperty('rateBands')
    })

    it('must start at the method’s level and ascend', () => {
      expect(
        problemsOf(() =>
          build({
            lv: 15,
            bands: [
              [20, 1],
              [30, 2],
            ],
          }),
        ),
      ).toEqual(['mining / Iron ore: bands must start at the method level and ascend'])
      expect(
        problemsOf(() =>
          build({
            lv: 15,
            bands: [
              [15, 1],
              [15, 2],
            ],
          }),
        ),
      ).toHaveLength(1)
      expect(
        problemsOf(() =>
          build({
            lv: 15,
            bands: [
              [15, 1],
              [40, 2],
              [30, 3],
            ],
          }),
        ),
      ).toHaveLength(1)
    })
  })

  describe('timed runs', () => {
    it('carry their XP per run and the minutes between runs', () => {
      const [method] = build({ run: true, per: 2_888.9, every: 200, xph: 5_000_000 })
      expect(method?.timedRun).toEqual({ xpPerRun: 2_888, everyMinutes: 200 })
    })

    it('are not made from an entry that only has the figures', () => {
      const [method] = build({ run: false, per: 2_888, every: 200 })
      expect(method).not.toHaveProperty('timedRun')
    })
  })

  describe('tick-perfect methods', () => {
    it.each(['Granite (3-tick)', 'Barbarian fishing (1.5-tick)', 'Teaks (2-tick) at Ape Atoll'])(
      'are recognised by a name like %s',
      (name) => {
        expect(build({ name })[0]?.tickPerfect).toBe(true)
      },
    )

    it('are recognised by a note that starts with the words', () => {
      expect(build({ note: 'Tick-perfect clicking throughout.' })[0]?.tickPerfect).toBe(true)
    })

    it('are not read into other names and notes', () => {
      expect(build({ name: 'Ticks and fleas' })[0]?.tickPerfect).toBe(false)
      expect(build({ note: 'Not tick-perfect.' })[0]?.tickPerfect).toBe(false)
    })
  })

  describe('quest-skip advice', () => {
    it.each(['Quest skip to level 34', 'Early quests', 'Natural history quiz', "Daddy's Home"])(
      'is recognised at level 1 by a name like %s',
      (name) => {
        expect(build({ name, lv: 1, xph: 0 })[0]?.questSkip).toBe(true)
      },
    )

    it('is not read into a method above level 1', () => {
      expect(build({ name: 'Quest point cape', lv: 2 })[0]?.questSkip).toBe(false)
    })
  })

  describe('what it refuses', () => {
    it.each<[string, Partial<MethodSource>, RegExp]>([
      ['a level of 0', { lv: 0 }, /level 0/],
      ['a level of 100', { lv: 100 }, /level 100/],
      ['a fractional level', { lv: 1.5 }, /level 1\.5/],
      ['an unknown intensity', { int: 'lazy' }, /intensity 'lazy'/],
      ['an unknown cost', { cost: 'dear' }, /cost 'dear'/],
      ['an unknown audience', { who: 'everyone' }, /who 'everyone'/],
      ['a negative rate', { xph: -1 }, /xp\/h -1/],
      ['a rate above two million', { xph: 2_000_001 }, /xp\/h 2000001/],
      ['a run’s rate above twenty million', { run: true, xph: 20_000_001 }, /xp\/h 20000001/],
      ['a missing source page', { src: '' }, /no source page/],
      ['an unknown worked-out rate', { calc: 'crab-prayer' }, /unknown calc 'crab-prayer'/],
      ['a requirement it cannot read', { req: 's:dancing 50' }, /bad skill requirement/],
    ])('refuses %s', (_case, overrides, problem) => {
      expect(problemsOf(() => build(overrides)).join('\n')).toMatch(problem)
    })

    it('allows a timed run a rate in the millions', () => {
      expect(build({ run: true, xph: 5_000_000, per: 1, every: 1 })).toHaveLength(1)
    })

    it('reports every problem at once, each with the method it is in', () => {
      const problems = problemsOf(() =>
        build({ name: 'First', lv: 0 }, { name: 'Second', int: 'lazy', cost: 'dear' }),
      )
      expect(problems).toEqual([
        'mining / First: level 0',
        "mining / Second: intensity 'lazy'",
        "mining / Second: cost 'dear'",
      ])
    })
  })
})

describe('buildQuests', () => {
  const fixed = (overrides: Partial<FixedQuestXpSource> = {}): FixedQuestXpSource => ({
    xp: {},
    ...overrides,
  })
  const lamp = (overrides: Partial<LampSource> = {}): LampSource => ({
    name: 'X Marks the Spot',
    rewards: '300, 1',
    restrictions: "'None'",
    requirements: "'None'",
    notes: null,
    ...overrides,
  })
  /** The quest facts of a sketch: each name a plain quest unless told otherwise. */
  const facts = (names: readonly string[], overrides: Record<string, Partial<QuestFacts>> = {}) =>
    names.map((name): QuestFacts => ({
      name,
      kind: 'quest',
      page: name,
      revision: 1,
      levels: {},
      requires: [],
      optional: false,
      doneByEveryAccount: false,
      ...overrides[name],
    }))
  const lampText = (overrides: Partial<LampSource>) => {
    const source = lamp(overrides)
    return buildQuests(fixed(), [source], facts([source.name.replaceAll("\\'", "'")]))[0]?.lamps
  }

  it('turns fixed XP into a quest, with its kind and its levels from the facts', () => {
    const quests = buildQuests(
      fixed({ xp: { 'Cold War': { agility: 5000, crafting: 2000 } } }),
      [],
      facts(['Cold War'], { 'Cold War': { levels: { agility: 30 } } }),
    )
    expect(quests).toEqual([
      {
        name: 'Cold War',
        kind: 'quest',
        fixedXp: { agility: 5000, crafting: 2000 },
        skillLevelsNeeded: { agility: 30 },
      },
    ])
  })

  it('rounds XP to the nearest whole number, halves to the even side', () => {
    const [quest] = buildQuests(
      fixed({
        xp: { Quest: { agility: 1000.5, herblore: 1001.5, prayer: 2812.4, magic: 2812.6 } },
      }),
      [],
      facts(['Quest']),
    )
    expect(quest?.fixedXp).toEqual({ agility: 1000, herblore: 1002, prayer: 2812, magic: 2813 })
  })

  it('uses the quest list’s names for the Recipe for Disaster subquests', () => {
    const quests = buildQuests(
      fixed({ xp: { 'Recipe for Disaster/Freeing Evil Dave': { cooking: 7000 } } }),
      [],
      facts(['Recipe for Disaster - Evil Dave'], {
        'Recipe for Disaster - Evil Dave': { kind: 'subquest' },
      }),
    )
    expect(quests.map((quest) => [quest.name, quest.kind])).toEqual([
      ['Recipe for Disaster - Evil Dave', 'subquest'],
    ])
  })

  it('takes what a quest is from the facts, under the quest list’s name', () => {
    const quests = buildQuests(
      fixed({ xp: { 'Knight Waves': { attack: 20_000 }, 'Enter the Abyss': { runecraft: 1000 } } }),
      [],
      facts(['Enter the Abyss', 'Knight Waves Training Grounds'], {
        'Enter the Abyss': { kind: 'miniquest' },
        'Knight Waves Training Grounds': { kind: 'activity' },
      }),
    )
    expect(quests.map((quest) => [quest.name, quest.kind])).toEqual([
      ['Enter the Abyss', 'miniquest'],
      ['Knight Waves Training Grounds', 'activity'],
    ])
  })

  it('puts a quest’s fixed XP and its lamps together', () => {
    const quests = buildQuests(
      fixed({ xp: { 'X Marks the Spot': { mining: 100 } } }),
      [lamp()],
      facts(['X Marks the Spot']),
    )
    expect(quests).toEqual([
      {
        name: 'X Marks the Spot',
        kind: 'quest',
        fixedXp: { mining: 100 },
        lamps: { description: 'A 300 xp lamp for any skill.', totalXp: 300 },
        skillLevelsNeeded: {},
      },
    ])
  })

  it('adds the lamps the facts give, as a quest of its own when it pays nothing else', () => {
    const museum = { description: 'A 1,000 xp lamp from Historian Minas.', totalXp: 1000 }
    const quests = buildQuests(
      fixed({ xp: { 'Making History': { crafting: 1000 } } }),
      [],
      facts(['Making History', 'Rune Mysteries', 'Shield of Arrav'], {
        'Making History': { lamps: museum },
        'Shield of Arrav': { lamps: museum },
      }),
    )
    expect(quests.map((quest) => [quest.name, quest.fixedXp, quest.lamps?.totalXp])).toEqual([
      ['Making History', { crafting: 1000 }, 1000],
      ['Shield of Arrav', {}, 1000],
    ])
  })

  it('lists quests in plain code-point order, capitals before lower case', () => {
    const names = ["A Soul's Bane", 'A Soul’s Bane', 'Zogre Flesh Eaters', 'apple']
    const quests = buildQuests(
      fixed({ xp: Object.fromEntries(names.map((name) => [name, {}])) }),
      [],
      facts(names),
    )
    expect(quests.map((quest) => quest.name)).toEqual(names)
  })

  it('refuses XP in a skill it does not know', () => {
    const problems = problemsOf(() =>
      buildQuests(fixed({ xp: { Quest: { dancing: 5 } } }), [], facts(['Quest'])),
    )
    expect(problems).toEqual(["quest Quest: unknown skill 'dancing'"])
  })

  it('refuses a quest that pays XP but is not in the facts, and lamps given twice', () => {
    const problems = problemsOf(() =>
      buildQuests(
        fixed({ xp: { 'Cold War': { agility: 5000 } } }),
        [lamp()],
        facts(['X Marks the Spot'], {
          'X Marks the Spot': { lamps: { description: 'A lamp.', totalXp: 1000 } },
        }),
      ),
    )
    expect(problems).toEqual([
      'quest X Marks the Spot: lamps in both the lamp table and the facts',
      'quest Cold War: pays XP, but is not in the quest facts',
    ])
  })

  describe('lamps', () => {
    it('describes several lamps and counts their total', () => {
      expect(lampText({ rewards: '2500, 2' })).toEqual({
        description: 'Two 2,500 xp lamps for any skill.',
        totalXp: 5000,
      })
    })

    it('says which level a skill has to be', () => {
      expect(lampText({ rewards: '10000, 1', restrictions: '50' })?.description).toBe(
        'A 10,000 xp lamp for any skill at level 50 or above.',
      )
    })

    it('lists the skills a lamp may be used on, across the wiki’s line breaks', () => {
      expect(
        lampText({ restrictions: "'Attack Strength <br/> Defence Hitpoints'" })?.description,
      ).toBe('A 300 xp lamp for Attack, Strength, Defence or Hitpoints.')
    })

    it('adds the wiki’s note about a minimum level', () => {
      expect(
        lampText({
          rewards: '20000, 4',
          restrictions: "'Attack Strength'",
          notes: "'The chosen skill must be at least level 50'",
        })?.description,
      ).toBe(
        'Four 20,000 xp lamps for Attack or Strength. The chosen skill must be at least level 50.',
      )
    })

    it('ignores other notes', () => {
      expect(lampText({ notes: "'Awarded by the Wise Old Man'" })?.description).toBe(
        'A 300 xp lamp for any skill.',
      )
    })

    it('writes out Monkey Madness I, whose reward the table cannot express', () => {
      const lamps = lampText({ name: 'Monkey Madness I', rewards: "35000, 1, '& 20,000'" })
      expect(lamps?.totalXp).toBe(110_000)
      expect(lamps?.description).toMatch(/^35,000 xp each in a chosen pair/)
    })

    it('unescapes apostrophes in quest names', () => {
      const [quest] = buildQuests(
        fixed(),
        [lamp({ name: "King\\'s Ransom" })],
        facts(["King's Ransom"]),
      )
      expect(quest?.name).toBe("King's Ransom")
    })
  })

  describe('skill levels', () => {
    it('takes a quest’s levels from its facts, under the quest list’s name', () => {
      const [quest] = buildQuests(
        fixed({ xp: { 'Recipe for Disaster/Freeing Skrach Uglogwee': { cooking: 1500 } } }),
        [],
        facts(['Recipe for Disaster - Skrach Uglogwee'], {
          'Recipe for Disaster - Skrach Uglogwee': { levels: { cooking: 41, firemaking: 20 } },
        }),
      )
      expect(quest?.skillLevelsNeeded).toEqual({ cooking: 41, firemaking: 20 })
    })

    it('does not read the levels in the lamp table’s Lua', () => {
      const requirements = "string.format('%s, %s', SCP('Farming', '49'), SCP('Herblore', '57'))"
      const quests = buildQuests(
        fixed({ xp: { 'X Marks the Spot': {} } }),
        [lamp({ requirements }), lamp({ name: 'Client of Kourend', requirements })],
        facts(['Client of Kourend', 'X Marks the Spot'], {
          'X Marks the Spot': { levels: { farming: 30 } },
        }),
      )
      expect(quests.map((quest) => [quest.name, quest.skillLevelsNeeded])).toEqual([
        ['Client of Kourend', {}],
        ['X Marks the Spot', { farming: 30 }],
      ])
    })
  })
})

describe('buildQuestFacts', () => {
  const entry = (overrides: Partial<QuestFactSource> = {}): QuestFactSource => ({
    kind: 'quest',
    page: 'A page',
    rev: 15_000_000,
    ...overrides,
  })

  it('turns each entry into facts, in plain code-point order, with what it needs and proves joined', () => {
    const built = buildQuestFacts({
      Watchtower: entry({
        page: 'Watchtower',
        levels: { mining: 40, herblore: 14 },
        implies: ['Druidic Ritual'],
      }),
      'Druidic Ritual': entry({ page: 'Druidic Ritual' }),
      Biohazard: entry({ page: 'Biohazard', requires: ['Plague City'] }),
      'Plague City': entry({ page: 'Plague City' }),
    })
    expect(built.map((quest) => quest.name)).toEqual([
      'Biohazard',
      'Druidic Ritual',
      'Plague City',
      'Watchtower',
    ])
    expect(built[3]).toEqual({
      name: 'Watchtower',
      kind: 'quest',
      page: 'Watchtower',
      revision: 15_000_000,
      levels: { mining: 40, herblore: 14 },
      requires: ['Druidic Ritual'],
      optional: false,
      doneByEveryAccount: false,
    })
    expect(built[0]?.requires).toEqual(['Plague City'])
  })

  it('describes the lamps it adds, and marks optional miniquests and the quest every account has done', () => {
    const [bear, learning, shield] = buildQuestFacts({
      'Bear Your Soul': entry({ kind: 'miniquest', optional: true }),
      'Learning the Ropes': entry({ everyAccount: true }),
      'Shield of Arrav': entry({
        lamps: [{ count: 1, xp: 1000, minLevel: 20, from: 'Historian Minas' }],
      }),
    })
    expect(bear).toMatchObject({ kind: 'miniquest', optional: true, doneByEveryAccount: false })
    expect(learning).toMatchObject({ optional: false, doneByEveryAccount: true })
    expect(shield?.lamps).toEqual({
      description: 'A 1,000 xp lamp from Historian Minas for any skill at level 20 or above.',
      totalXp: 1000,
    })
  })

  it.each<[string, Record<string, QuestFactSource>, RegExp]>([
    ['a kind it does not know', { Quest: entry({ kind: 'saga' }) }, /Quest: kind 'saga'/],
    ['an entry with no page', { Quest: entry({ page: ' ' }) }, /Quest: no page/],
    ['a revision that is not one', { Quest: entry({ rev: 0 }) }, /Quest: revision 0/],
    [
      'a skill it does not know',
      { Quest: entry({ levels: { dancing: 5 } }) },
      /Quest: needs unknown skill 'dancing'/,
    ],
    ['a level past 99', { Quest: entry({ levels: { mining: 100 } }) }, /Quest: mining 100/],
    [
      'a quest needed that is not an entry',
      { Quest: entry({ requires: ['Plage City'] }) },
      /Quest: needs 'Plage City', which is not an entry/,
    ],
    ['a quest that needs itself', { Quest: entry({ requires: ['Quest'] }) }, /Quest: needs itself/],
    [
      'a chain that comes back on itself',
      {
        Biohazard: entry({ requires: ['Plague City'] }),
        'Plague City': entry({ implies: ['Underground Pass'] }),
        'Underground Pass': entry({ requires: ['Biohazard'] }),
      },
      /Biohazard > Plague City > Underground Pass > Biohazard is a cycle/,
    ],
    [
      'an optional entry that is not a miniquest',
      { Quest: entry({ optional: true }) },
      /Quest: optional, but not a miniquest/,
    ],
    [
      'a name with a curly apostrophe',
      { 'King’s Ransom': entry() },
      /'King’s Ransom': spelt unlike a tick/,
    ],
    [
      'a lamp that pays nothing',
      { Quest: entry({ lamps: [{ count: 1, xp: 0, minLevel: 20, from: 'Historian Minas' }] }) },
      /Quest: lamp xp 0/,
    ],
  ])('refuses %s', (_case, source, problem) => {
    expect(problemsOf(() => buildQuestFacts(source)).join('\n')).toMatch(problem)
  })
})

describe('buildResets', () => {
  const resetSource = (overrides: Partial<ResetSource> = {}): ResetSource => ({
    k: 'herb',
    n: 'Herb run',
    every: 80,
    skill: 'farming',
    req: 's:farming 9',
    note: 'Every herb patch.',
    src: 'Herb patch',
    ...overrides,
  })
  const build = (...sources: Partial<ResetSource>[]) => buildResets(sources.map(resetSource))

  it('turns a source entry into a reset', () => {
    expect(build({})).toEqual([
      {
        key: 'herb',
        name: 'Herb run',
        schedule: { kind: 'interval', minutes: 80 },
        skill: 'farming',
        requirements: { ...NO_REQUIREMENTS, skills: [{ skill: 'farming', level: 9 }] },
        note: 'Every herb patch.',
        source: 'Herb patch',
        audience: 'both',
      },
    ])
  })

  it('reads each kind of cadence', () => {
    const schedules = build(
      { every: 'utc' },
      { every: 'weekly' },
      {
        every: [
          [15, 200],
          [30, 240],
        ],
      },
    ).map((reset) => reset.schedule)
    expect(schedules).toEqual([
      { kind: 'utc-midnight' },
      { kind: 'weekly' },
      {
        kind: 'by-level',
        skill: 'farming',
        steps: [
          { fromLevel: 15, minutes: 200 },
          { fromLevel: 30, minutes: 240 },
        ],
      },
    ])
  })

  it('has no skill, no requirements and both audiences unless the source says so', () => {
    const [reset] = build({ every: 'utc', skill: '', req: undefined, who: undefined })
    expect(reset).toMatchObject({ skill: null, requirements: NO_REQUIREMENTS, audience: 'both' })
    expect(build({ who: 'main' })[0]?.audience).toBe('main')
  })

  it('keeps the source’s order', () => {
    expect(
      build({ k: 'tree' }, { k: 'herb' }, { k: 'birdhouse' }).map((reset) => reset.key),
    ).toEqual(['tree', 'herb', 'birdhouse'])
  })

  it.each<[string, Partial<ResetSource>, RegExp]>([
    ['a cadence of zero', { every: 0 }, /every 0/],
    ['a cadence in words it does not know', { every: 'daily' }, /every "daily"/],
    ['an empty list of steps', { every: [] }, /every \[\]/],
    ['a step that is not a pair', { every: [[15, 200, 1]] }, /every \[\[15,200,1\]\]/],
    [
      'steps with no skill to read them against',
      { every: [[15, 200]], skill: '' },
      /needs a skill/,
    ],
    ['a skill it does not know', { skill: 'dancing' }, /unknown skill 'dancing'/],
    ['a requirement it cannot read', { req: 'd:Lumbridge Medium' }, /bad diary requirement/],
  ])('refuses %s', (_case, overrides, problem) => {
    expect(problemsOf(() => build(overrides)).join('\n')).toMatch(problem)
  })
})

/* How datasrc/ entries become the app's data, and what the builders refuse. */
import { describe, expect, it } from 'vitest'
import { buildMethods } from '#shared/data/build-methods'
import { buildQuestPrerequisites } from '#shared/data/build-quest-prerequisites'
import { buildQuests } from '#shared/data/build-quests'
import { buildResets } from '#shared/data/build-resets'
import { DataSourceError, QUEST_PREREQUISITE_MODULE } from '#shared/data/sources'
import type {
  FixedQuestXpSource,
  LampSource,
  MethodSource,
  QuestPrerequisiteSource,
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
      },
    ])
  })

  it('tidies names and notes', () => {
    const [method] = build({ name: ' Iron ore ', note: '  Three   rocks.\n Bank at the chest. ' })
    expect(method?.name).toBe('Iron ore')
    expect(method?.note).toBe('Three rocks. Bank at the chest.')
  })

  it('carries the flags across', () => {
    const [method] = build({ who: 'iron', supply: true, setup: true, calc: 'crab-melee', xph: 0 })
    expect(method).toMatchObject({
      audience: 'iron',
      usesOwnSupplies: true,
      perTripSetup: true,
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
    need: {},
    mini: [],
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
  const lampText = (overrides: Partial<LampSource>) =>
    buildQuests(fixed(), [lamp(overrides)])[0]?.lamps

  it('turns fixed XP into a quest', () => {
    const quests = buildQuests(
      fixed({
        xp: { 'Cold War': { agility: 5000, crafting: 2000 } },
        need: { 'Cold War': { agility: 30 } },
      }),
      [],
    )
    expect(quests).toEqual([
      {
        name: 'Cold War',
        fixedXp: { agility: 5000, crafting: 2000 },
        skillLevelsNeeded: { agility: 30 },
        miniquest: false,
      },
    ])
  })

  it('rounds XP to the nearest whole number, halves to the even side', () => {
    const [quest] = buildQuests(
      fixed({
        xp: { Quest: { agility: 1000.5, herblore: 1001.5, prayer: 2812.4, magic: 2812.6 } },
      }),
      [],
    )
    expect(quest?.fixedXp).toEqual({ agility: 1000, herblore: 1002, prayer: 2812, magic: 2813 })
  })

  it('uses the quest list’s names for the Recipe for Disaster subquests', () => {
    const quests = buildQuests(
      fixed({ xp: { 'Recipe for Disaster/Freeing Evil Dave': { cooking: 7000 } } }),
      [],
    )
    expect(quests.map((quest) => quest.name)).toEqual(['Recipe for Disaster - Evil Dave'])
  })

  it('marks miniquests, going by the wiki’s name for them', () => {
    const quests = buildQuests(
      fixed({
        xp: { 'Knight Waves': { attack: 20_000 }, 'Cold War': { agility: 5000 } },
        mini: ['Knight Waves'],
      }),
      [],
    )
    expect(quests.map((quest) => [quest.name, quest.miniquest])).toEqual([
      ['Cold War', false],
      ['Knight Waves Training Grounds', true],
    ])
  })

  it('puts a quest’s fixed XP and its lamps together', () => {
    const quests = buildQuests(fixed({ xp: { 'X Marks the Spot': { mining: 100 } } }), [lamp()])
    expect(quests).toEqual([
      {
        name: 'X Marks the Spot',
        fixedXp: { mining: 100 },
        lamps: { description: 'A 300 xp lamp for any skill.', totalXp: 300 },
        skillLevelsNeeded: {},
        miniquest: false,
      },
    ])
  })

  it('lists quests in plain code-point order, capitals before lower case', () => {
    const quests = buildQuests(
      fixed({
        xp: { 'Zogre Flesh Eaters': {}, 'A Soul’s Bane': {}, "A Soul's Bane": {}, apple: {} },
      }),
      [],
    )
    expect(quests.map((quest) => quest.name)).toEqual([
      "A Soul's Bane",
      'A Soul’s Bane',
      'Zogre Flesh Eaters',
      'apple',
    ])
  })

  it('refuses XP in a skill it does not know', () => {
    const problems = problemsOf(() => buildQuests(fixed({ xp: { Quest: { dancing: 5 } } }), []))
    expect(problems).toEqual(["quest Quest: unknown skill 'dancing'"])
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
      const [quest] = buildQuests(fixed(), [lamp({ name: "King\\'s Ransom" })])
      expect(quest?.name).toBe("King's Ransom")
    })

    it('reads the skill levels a quest needs out of the wiki’s Lua', () => {
      const [quest] = buildQuests(fixed(), [
        lamp({
          requirements: "string.format('%s, %s', SCP('Farming', '49'), SCP('Herblore', '57'))",
        }),
      ])
      expect(quest?.skillLevelsNeeded).toEqual({ farming: 49, herblore: 57 })
    })

    it('keeps the higher level when both sources name one', () => {
      const need = { 'X Marks the Spot': { farming: 60, herblore: 10 } }
      const [quest] = buildQuests(fixed({ xp: { 'X Marks the Spot': {} }, need }), [
        lamp({ requirements: "SCP('Farming', '49'), SCP('Herblore', '57')" }),
      ])
      expect(quest?.skillLevelsNeeded).toEqual({ farming: 60, herblore: 57 })
    })
  })
})

describe('buildQuestPrerequisites', () => {
  /** A source file from a sketch: each name with what it requires, all from the wiki's module. */
  const moduleSource = (
    requires: Record<string, string[]>,
  ): Record<string, QuestPrerequisiteSource> =>
    Object.fromEntries(
      Object.entries(requires).map(([name, required]) => [
        name,
        { src: QUEST_PREREQUISITE_MODULE, requires: required },
      ]),
    )

  const KNOWN = ['Biohazard', "King's Ransom", 'Plague City', 'Underground Pass', 'Watchtower']

  const build = (requires: Record<string, string[]>, known: readonly string[] = KNOWN) =>
    buildQuestPrerequisites(moduleSource(requires), known)

  const requiredBy = (requires: Record<string, string[]>, known?: readonly string[]) =>
    Object.fromEntries(build(requires, known).requires)

  it('keeps what each known quest requires, in name order, and leaves out a quest that requires nothing', () => {
    expect(
      requiredBy({
        'Plague City': [],
        Biohazard: ['Plague City'],
        'Underground Pass': ['Plague City', 'Biohazard'],
      }),
    ).toEqual({ Biohazard: ['Plague City'], 'Underground Pass': ['Biohazard', 'Plague City'] })
  })

  it('leaves out a requirement that only has to be started', () => {
    expect(
      requiredBy({ 'Underground Pass': ['Started:Plague City', 'Biohazard'], Biohazard: [] }),
    ).toEqual({ 'Underground Pass': ['Biohazard'] })
  })

  it('straightens apostrophes and trims stray spaces, in entry names and in requirements', () => {
    expect(
      requiredBy({ 'King’s Ransom': ['Watchtower '], ' Biohazard': ['King’s Ransom'] }),
    ).toEqual({ "King's Ransom": ['Watchtower'], Biohazard: ["King's Ransom"] })
  })

  it('gives the Recipe for Disaster subquests and the two oddly titled miniquests the quest list’s names', () => {
    const known = [
      'Monkey Madness I',
      'Natural history quiz',
      'Recipe for Disaster - King Awowogei',
      'Vale Totems',
    ]
    const built = build(
      {
        'Recipe for Disaster/Freeing King Awowogei': ['Monkey Madness I'],
        'Natural History Quiz': [],
        'Vale Totems (miniquest)': ['Recipe for Disaster/Freeing King Awowogei'],
      },
      known,
    )
    expect(Object.fromEntries(built.requires)).toEqual({
      'Recipe for Disaster - King Awowogei': ['Monkey Madness I'],
      'Vale Totems': ['Recipe for Disaster - King Awowogei'],
    })
    expect(built.unlisted).toEqual(['Monkey Madness I'])
  })

  it('drops an entry the app does not track, but passes on what it requires', () => {
    // Troll Stronghold pays no XP and gates nothing, so the app does not know it; Death Plateau it does
    const known = ['Death Plateau', 'Desert Treasure I']
    expect(
      requiredBy(
        {
          'Desert Treasure I': ['Troll Stronghold'],
          'Troll Stronghold': ['Death Plateau', 'Started:Desert Treasure I'],
          'Death Plateau': [],
          'Easy Ardougne Diary': ['Death Plateau'],
        },
        known,
      ),
    ).toEqual({ 'Desert Treasure I': ['Death Plateau'] })
  })

  it('names a quest once however many ways lead to it', () => {
    const known = ['Biohazard', 'Plague City']
    expect(
      requiredBy(
        { Biohazard: ['Plague City', 'Clock Tower'], 'Clock Tower': ['Plague City'] },
        known,
      ),
    ).toEqual({ Biohazard: ['Plague City'] })
  })

  it('ignores the placeholders of the module’s own template', () => {
    expect(
      requiredBy({
        Name_of_quest: ['subquest', 'subquest'],
        Biohazard: ['subquest', 'Plague City'],
      }),
    ).toEqual({ Biohazard: ['Plague City'] })
  })

  it('leaves out a requirement the wiki names without an entry, when it is listed as untracked', () => {
    expect(requiredBy({ Biohazard: ['Architectural Alliance', 'Plague City'] })).toEqual({
      Biohazard: ['Plague City'],
    })
  })

  it('says which known quests were read from their own page and which have no entry at all', () => {
    const built = buildQuestPrerequisites(
      {
        Biohazard: { src: QUEST_PREREQUISITE_MODULE, requires: ['Plague City'] },
        Watchtower: { src: 'Watchtower', requires: [] },
        'Clock Tower': { src: 'Clock Tower', requires: [] },
      },
      KNOWN,
    )
    expect(built.fromOwnPage).toEqual(['Watchtower'])
    expect(built.unlisted).toEqual(["King's Ransom", 'Plague City', 'Underground Pass'])
  })

  it.each<[string, Record<string, string[]>, RegExp]>([
    [
      'a requirement that is neither a known quest nor an entry',
      { Biohazard: ['Plage City'] },
      /Biohazard requires 'Plage City', which nothing knows/,
    ],
    [
      'a chain that comes back on itself',
      {
        Biohazard: ['Plague City'],
        'Plague City': ['Underground Pass'],
        'Underground Pass': ['Biohazard'],
      },
      /Biohazard > Plague City > Underground Pass > Biohazard is a cycle/,
    ],
    [
      'a quest that requires itself',
      { Biohazard: ['Biohazard'] },
      /Biohazard > Biohazard is a cycle/,
    ],
    [
      'untracked entries that require each other',
      {
        Biohazard: ['Clock Tower'],
        'Clock Tower': ['Demon Slayer'],
        'Demon Slayer': ['Clock Tower'],
      },
      /Clock Tower > Demon Slayer > Clock Tower is a cycle/,
    ],
    [
      'two entries that come to the same name',
      { "King's Ransom": [], 'King’s Ransom': [] },
      /'King's Ransom' has two entries/,
    ],
  ])('refuses %s', (_case, requires, problem) => {
    expect(problemsOf(() => build(requires)).join('\n')).toMatch(problem)
  })

  it('refuses an entry that does not say where it came from', () => {
    const source = { Biohazard: { src: ' ', requires: [] } }
    expect(problemsOf(() => buildQuestPrerequisites(source, KNOWN)).join('\n')).toMatch(
      /'Biohazard' has no source page/,
    )
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

/* How datasrc/ entries become the app's data, and what the builders refuse. */
import { describe, expect, it } from 'vitest'
import type { QuestFacts } from '#shared/types/quest'
import { buildBoosts } from '#shared/data/build-boosts'
import { buildMethods } from '#shared/data/build-methods'
import { buildDiaryFacts } from '#shared/data/build-diary-facts'
import { buildGoals } from '#shared/data/build-goals'
import { buildQuestFacts } from '#shared/data/build-quest-facts'
import { buildQuests } from '#shared/data/build-quests'
import { buildResets } from '#shared/data/build-resets'
import { DataSourceError } from '#shared/data/sources'
import type {
  BoostSource,
  DiaryFactSource,
  FixedQuestXpSource,
  GoalSource,
  LampSource,
  MethodSource,
  QuestFactSource,
  ResetSource,
} from '#shared/data/sources'
import { DIARY_REGIONS, DIARY_TIERS } from '#shared/data/diaries'
import { NO_REQUIREMENTS } from '#shared/domain/requirements'
import { questFactsWith } from '../domain/helpers'

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
    names.map((name) => questFactsWith(name, overrides[name]))
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
      requiresStarted: [],
      optional: false,
      doneByEveryAccount: false,
      startedMatters: false,
      needs: {
        boostable: [],
        finishOnly: [],
        bypassable: [],
        questPoints: 0,
        combat: 0,
        kudos: 0,
        ironman: [],
      },
      gives: { questPoints: 0, kudos: 0, kudosOpened: 0, xpChoices: [], xpDuring: {} },
      time: { minutes: null, ironmanMinutes: 0, waitMinutes: 0, ironmanWaitMinutes: 0 },
      guide: { main: null, ironman: null },
    })
    expect(built[0]?.requires).toEqual(['Plague City'])
  })

  it('keeps the quests needed only started out of the chain, and marks the ones whose start matters', () => {
    const [creature, priest, ghost] = buildQuestFacts({
      'Creature of Fenkenstrain': entry({
        requires: ['Priest in Peril'],
        requiresStarted: ['The Restless Ghost'],
      }),
      'The Restless Ghost': entry({ startedMatters: true }),
      'Priest in Peril': entry(),
    })
    expect(creature).toMatchObject({
      name: 'Creature of Fenkenstrain',
      requires: ['Priest in Peril'],
      requiresStarted: ['The Restless Ghost'],
      startedMatters: false,
    })
    expect(priest).toMatchObject({ name: 'Priest in Peril', startedMatters: false })
    expect(ghost).toMatchObject({ name: 'The Restless Ghost', startedMatters: true })
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

  it('reads what readiness needs: levels to boost, finish only or get round, counts, an ironman’s needs, and what it gives', () => {
    const [quest] = buildQuestFacts({
      Quest: entry({
        levels: { fishing: 62, magic: 66, ranged: 40 },
        boostable: ['fishing', 'magic'],
        finishOnly: ['magic'],
        bypassable: ['ranged'],
        questPoints: 100,
        combat: 85,
        kudos: 100,
        ironman: [
          {
            need: 'a mithril grapple',
            options: [
              [
                { skill: 'fletching', level: 59 },
                { skill: 'smithing', level: 59 },
              ],
              [{ skill: 'firemaking', level: 35 }],
            ],
          },
          {
            need: 'steel nails',
            options: [[{ skill: 'smithing', level: 34 }]],
            condition: 'free-to-play only',
          },
        ],
        givesQuestPoints: 2,
        givesKudos: 5,
        opensKudos: 50,
      }),
    })
    expect(quest?.needs).toEqual({
      boostable: ['fishing', 'magic'],
      finishOnly: ['magic'],
      bypassable: ['ranged'],
      questPoints: 100,
      combat: 85,
      kudos: 100,
      ironman: [
        {
          need: 'a mithril grapple',
          options: [
            [
              { skill: 'fletching', level: 59 },
              { skill: 'smithing', level: 59 },
            ],
            [{ skill: 'firemaking', level: 35 }],
          ],
          condition: null,
        },
        {
          need: 'steel nails',
          options: [[{ skill: 'smithing', level: 34 }]],
          condition: 'free-to-play only',
        },
      ],
    })
    expect(quest?.gives).toEqual({
      questPoints: 2,
      kudos: 5,
      kudosOpened: 50,
      xpChoices: [],
      xpDuring: {},
    })
  })

  it('reads what suggestions need: minutes, the XP a player places, XP during the quest, guide steps', () => {
    const [quest] = buildQuestFacts({
      Quest: entry({
        minutes: { low: 32, mid: 43, high: 64 },
        ironmanMinutes: 10,
        waitMinutes: 15,
        ironmanWaitMinutes: 300,
        xpChoices: [
          { count: 1, xp: 2500, skills: 'any', minLevel: 30 },
          { count: 2, xp: 4650, skills: ['agility', 'thieving'], minLevel: 0 },
        ],
        xpDuring: { firemaking: 8000 },
        guide: { main: { start: 62, finish: 249 }, ironman: { finish: 235 } },
      }),
    })
    expect(quest?.time).toEqual({
      minutes: { low: 32, mid: 43, high: 64 },
      ironmanMinutes: 10,
      waitMinutes: 15,
      ironmanWaitMinutes: 300,
    })
    expect(quest?.gives.xpChoices).toEqual([
      { count: 1, xp: 2500, skills: 'any', minLevel: 30 },
      { count: 2, xp: 4650, skills: ['agility', 'thieving'], minLevel: 0 },
    ])
    expect(quest?.gives.xpDuring).toEqual({ firemaking: 8000 })
    expect(quest?.guide).toEqual({
      main: { start: 62, finish: 249 },
      ironman: { start: null, finish: 235 },
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
      'a quest needed started that is not an entry',
      { Quest: entry({ requiresStarted: ['The Restles Ghost'] }) },
      /Quest: needs 'The Restles Ghost', which is not an entry/,
    ],
    [
      'a quest needed both finished and started',
      {
        Quest: entry({ requires: ['Plague City'], requiresStarted: ['Plague City'] }),
        'Plague City': entry({ startedMatters: true }),
      },
      /Quest: needs 'Plague City' finished and started/,
    ],
    [
      'a quest needed started whose start is not marked as mattering',
      { Quest: entry({ requiresStarted: ['Plague City'] }), 'Plague City': entry() },
      /Quest: needs 'Plague City' started, which is not marked as mattering started/,
    ],
    [
      'a chain that comes back on itself through a quest needed started',
      {
        Biohazard: entry({ requires: ['Plague City'] }),
        'Plague City': entry({ requiresStarted: ['Biohazard'] }),
      },
      /Biohazard > Plague City > Biohazard is a cycle/,
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
    [
      'a boostable skill it needs no level in',
      { Quest: entry({ boostable: ['fishing'] }) },
      /Quest: boostable names fishing, which it needs no level in/,
    ],
    [
      'a skill it does not know, needed only to finish',
      { Quest: entry({ levels: { mining: 5 }, finishOnly: ['dancing'] }) },
      /Quest: finishOnly names unknown skill 'dancing'/,
    ],
    [
      'a skill named twice as bypassable',
      { Quest: entry({ levels: { mining: 5 }, bypassable: ['mining', 'mining'] }) },
      /Quest: bypassable names mining twice/,
    ],
    [
      'quest points needed that are not a whole number',
      { Quest: entry({ questPoints: 1.5 }) },
      /Quest: quest points needed 1.5/,
    ],
    [
      'an ironman need with an empty option',
      { Quest: entry({ ironman: [{ need: 'a shield', options: [[]] }] }) },
      /Quest: an ironman need with an empty option/,
    ],
    [
      'an ironman level past 99',
      {
        Quest: entry({
          ironman: [{ need: 'a shield', options: [[{ skill: 'smithing', level: 100 }]] }],
        }),
      },
      /Quest ironman: smithing 100/,
    ],
    [
      'quest points from a miniquest',
      { Quest: entry({ kind: 'miniquest', givesQuestPoints: 1 }) },
      /Quest: gives quest points, but is not a quest/,
    ],
    [
      'minutes out of order',
      { Quest: entry({ minutes: { low: 50, mid: 43, high: 64 } }) },
      /Quest: minutes 50, 43, 64/,
    ],
    [
      'an xp choice in a skill it does not know',
      { Quest: entry({ xpChoices: [{ count: 1, xp: 500, skills: ['dancing'], minLevel: 0 }] }) },
      /Quest: an xp choice of 1 x 500 in dancing/,
    ],
    [
      'xp during the quest that is not a whole number',
      { Quest: entry({ xpDuring: { farming: 31.5 } }) },
      /Quest: xp during of 31.5 in 'farming'/,
    ],
    [
      'a guide that starts a quest after it finishes it',
      { Quest: entry({ guide: { main: { start: 80, finish: 62 } } }) },
      /Quest main guide: guide steps 80 to 62/,
    ],
    [
      'a guide it does not know',
      { Quest: entry({ guide: { f2p: { finish: 3 } } }) },
      /Quest: a guide 'f2p'/,
    ],
  ])('refuses %s', (_case, source, problem) => {
    expect(problemsOf(() => buildQuestFacts(source)).join('\n')).toMatch(problem)
  })
})

describe('buildDiaryFacts', () => {
  const quests = buildQuestFacts({
    'Fairytale II - Cure a Queen': {
      kind: 'quest',
      page: 'Fairytale II',
      rev: 1,
      startedMatters: true,
    },
    'Plague City': { kind: 'quest', page: 'Plague City', rev: 1 },
  })
  /** Every tier the app knows, each with no quests unless given some. */
  const everyTier = (
    overrides: Record<string, Partial<DiaryFactSource>> = {},
  ): Record<string, DiaryFactSource> =>
    Object.fromEntries(
      DIARY_REGIONS.flatMap((region) =>
        DIARY_TIERS.map((tier) => {
          const name = `${region} ${tier}`
          return [
            name,
            {
              page: `${region} Diary`,
              rev: 15_000_000,
              quests: {},
              minutes: { low: 10, mid: 15, high: 20 },
              ...overrides[name],
            },
          ]
        }),
      ),
    )

  it('builds the 48 tiers region by region, easiest first, with the quests their tasks need', () => {
    const built = buildDiaryFacts(
      everyTier({
        'Ardougne Medium': {
          quests: { 'Fairytale II - Cure a Queen': 'started', 'Plague City': 'finished' },
        },
      }),
      quests,
    )
    expect(built).toHaveLength(48)
    expect(built.slice(0, 5).map((diary) => diary.name)).toEqual([
      'Ardougne Easy',
      'Ardougne Medium',
      'Ardougne Hard',
      'Ardougne Elite',
      'Desert Easy',
    ])
    expect(built[1]).toEqual({
      name: 'Ardougne Medium',
      region: 'Ardougne',
      tier: 'Medium',
      page: 'Ardougne Diary',
      revision: 15_000_000,
      quests: { 'Fairytale II - Cure a Queen': 'started', 'Plague City': 'finished' },
      planFinished: [],
      levels: {},
      boostable: [],
      raiments: null,
      choices: [],
      questPoints: 0,
      combat: 0,
      kudos: 0,
      allQuests: false,
      ironman: [],
      longTasks: [],
      also: [],
      gates: [],
      minutes: { low: 10, mid: 15, high: 20 },
      items: [],
      lamp: null,
      recommended: false,
    })
  })

  it.each<[string, Record<string, DiaryFactSource>, RegExp]>([
    [
      'a missing tier',
      Object.fromEntries(Object.entries(everyTier()).filter(([name]) => name !== 'Varrock Elite')),
      /Varrock Elite: missing/,
    ],
    [
      'a tier it does not know',
      { ...everyTier(), 'Varrock Master': { page: 'Varrock Diary', rev: 1, quests: {} } },
      /'Varrock Master': not a tier the app knows/,
    ],
    ['a tier with no page', everyTier({ 'Desert Hard': { page: ' ' } }), /Desert Hard: no page/],
    [
      'a revision that is not one',
      everyTier({ 'Desert Hard': { rev: -1 } }),
      /Desert Hard: revision -1/,
    ],
    [
      'a quest that is not an entry',
      everyTier({ 'Desert Hard': { quests: { Contact: 'finished' } } }),
      /Desert Hard: needs 'Contact', which is not a quest entry/,
    ],
    [
      'a state it does not know',
      everyTier({ 'Desert Hard': { quests: { 'Plague City': 'halfway' } } }),
      /Desert Hard: needs 'Plague City' halfway/,
    ],
    [
      'a quest needed started whose start is not marked as mattering',
      everyTier({ 'Desert Hard': { quests: { 'Plague City': 'started' } } }),
      /Desert Hard: needs 'Plague City' started, which is not marked as mattering started/,
    ],
    [
      'a quest planned finished that it does not read started',
      everyTier({
        'Desert Hard': { quests: { 'Plague City': 'finished' }, planFinished: ['Plague City'] },
      }),
      /Desert Hard: plans 'Plague City' finished, which it does not read started/,
    ],
    [
      'a level past 99',
      everyTier({ 'Desert Hard': { levels: { smithing: 100 } } }),
      /Desert Hard: smithing 100/,
    ],
    [
      'a boostable skill it needs no level in',
      everyTier({ 'Desert Hard': { boostable: ['smithing'] } }),
      /Desert Hard: boostable names smithing, which it needs no level in/,
    ],
    [
      'a Raiments of the Eye level no lower than its Runecraft',
      everyTier({
        'Varrock Elite': { levels: { runecraft: 50 }, raiments: { level: 52, pieces: 2 } },
      }),
      /Varrock Elite: 52 Runecraft with 2 pieces/,
    ],
    [
      'more Raiments of the Eye pieces than there are',
      everyTier({
        'Varrock Elite': { levels: { runecraft: 78 }, raiments: { level: 52, pieces: 5 } },
      }),
      /Varrock Elite: 52 Runecraft with 5 pieces/,
    ],
    [
      'a choice of one option',
      everyTier({ 'Karamja Hard': { choices: [{ options: [[{ combat: 100 }]] }] } }),
      /Karamja Hard: a choice of fewer than two options/,
    ],
    [
      'a choice item that is two things',
      everyTier({
        'Karamja Hard': {
          choices: [{ options: [[{ combat: 100, other: 'a slayer cape' }], [{ combat: 90 }]] }],
        },
      }),
      /Karamja Hard: a choice item that is not one thing/,
    ],
    [
      'a choice of a quest that is not an entry',
      everyTier({
        'Karamja Hard': {
          choices: [{ options: [[{ quest: 'Contact', state: 'finished' }], [{ combat: 90 }]] }],
        },
      }),
      /Karamja Hard: a choice of 'Contact', not a quest entry/,
    ],
    [
      'a gate that is neither a method nor a reset',
      everyTier({ 'Desert Hard': { gates: [{ kind: 'shop', name: 'Zahur' }] } }),
      /Desert Hard: a gate of kind 'shop'/,
    ],
    [
      'a long task of nothing',
      everyTier({
        'Western Provinces Elite': { longTasks: [{ amount: 0, unit: 'kills', text: '' }] },
      }),
      /Western Provinces Elite: a long task of 0 kills/,
    ],
    [
      'an ironman level in a skill it does not know',
      everyTier({ 'Varrock Hard': { ironman: [{ skill: 'dancing', level: 69 }] } }),
      /Varrock Hard ironman: unknown skill 'dancing'/,
    ],
    [
      'a tier with no minutes',
      everyTier({ 'Desert Hard': { minutes: undefined } }),
      /Desert Hard: no minutes/,
    ],
    [
      'a lamp of no xp',
      everyTier({ 'Desert Hard': { lamp: { xp: 0, minLevel: 50 } } }),
      /Desert Hard: a lamp of 0 xp at level 50/,
    ],
  ])('refuses %s', (_case, source, problem) => {
    expect(problemsOf(() => buildDiaryFacts(source, quests)).join('\n')).toMatch(problem)
  })

  it('reads what readiness needs of a tier', () => {
    const built = buildDiaryFacts(
      everyTier({
        'Varrock Elite': {
          quests: { 'Fairytale II - Cure a Queen': 'started', 'Plague City': 'finished' },
          planFinished: ['Fairytale II - Cure a Queen'],
          levels: { runecraft: 78, cooking: 95, attack: 42 },
          boostable: ['runecraft', 'cooking'],
          raiments: { level: 52, pieces: 2 },
          choices: [
            {
              options: [
                [{ combat: 100 }],
                [{ skill: 'slayer', level: 99 }],
                [{ quest: 'Plague City', state: 'started' }, { other: 'a cooked oomlie wrap' }],
                [{ skill: 'cooking', level: 50, boostable: true }],
              ],
              note: 'Duradel assigns tasks at 100 combat',
            },
          ],
          questPoints: 32,
          combat: 40,
          kudos: 153,
          allQuests: true,
          ironman: [{ skill: 'hunter', level: 69 }],
          longTasks: [{ amount: 1000, unit: 'chompy kills', text: '1,000 chompy kills' }],
          also: ['Access to the Earth Altar'],
          gates: [{ kind: 'reset', name: 'Battlestaves from Zaff' }],
          minutes: { low: 16, mid: 21, high: 32 },
          items: ['Varrock armour 4'],
          lamp: { xp: 50_000, minLevel: 70 },
          recommended: true,
        },
      }),
      quests,
    )
    expect(built.find((diary) => diary.name === 'Varrock Elite')).toEqual({
      name: 'Varrock Elite',
      region: 'Varrock',
      tier: 'Elite',
      page: 'Varrock Diary',
      revision: 15_000_000,
      quests: { 'Fairytale II - Cure a Queen': 'started', 'Plague City': 'finished' },
      planFinished: ['Fairytale II - Cure a Queen'],
      levels: { runecraft: 78, cooking: 95, attack: 42 },
      boostable: ['runecraft', 'cooking'],
      raiments: { level: 52, pieces: 2 },
      choices: [
        {
          options: [
            [{ kind: 'combat', level: 100 }],
            [{ kind: 'skill', skill: 'slayer', level: 99, boostable: false }],
            [
              { kind: 'quest', quest: 'Plague City', state: 'started' },
              { kind: 'other', text: 'a cooked oomlie wrap' },
            ],
            [{ kind: 'skill', skill: 'cooking', level: 50, boostable: true }],
          ],
          note: 'Duradel assigns tasks at 100 combat',
        },
      ],
      questPoints: 32,
      combat: 40,
      kudos: 153,
      allQuests: true,
      ironman: [{ skill: 'hunter', level: 69 }],
      longTasks: [{ amount: 1000, unit: 'chompy kills', text: '1,000 chompy kills' }],
      also: ['Access to the Earth Altar'],
      gates: [{ kind: 'reset', name: 'Battlestaves from Zaff' }],
      minutes: { low: 16, mid: 21, high: 32 },
      items: ['Varrock armour 4'],
      lamp: { xp: 50_000, minLevel: 70 },
      recommended: true,
    })
  })
})

describe('buildBoosts', () => {
  const boost = (overrides: Partial<BoostSource> = {}): BoostSource => ({
    name: 'Super fishing potion',
    phrase: 'a super fishing potion',
    page: 'Super fishing potion',
    rev: 15_000_000,
    flat: 6,
    main: 'always',
    ironman: { skill: 'herblore', level: 62 },
    ...overrides,
  })

  it('turns each skill’s boosts into the app’s: a flat size or a share of the level, and who may count it', () => {
    const delight = boost({
      name: "Chef's delight(m)",
      phrase: "a mature chef's delight",
      page: "Chef's delight(m)",
      flat: undefined,
      base: 2,
      percent: 5,
      ironman: 'never',
    })
    expect(buildBoosts({ fishing: [boost()], cooking: [delight] })).toEqual({
      fishing: [
        {
          name: 'Super fishing potion',
          phrase: 'a super fishing potion',
          page: 'Super fishing potion',
          revision: 15_000_000,
          amount: { flat: 6 },
          main: 'always',
          ironman: { skill: 'herblore', level: 62 },
        },
      ],
      cooking: [
        {
          name: "Chef's delight(m)",
          phrase: "a mature chef's delight",
          page: "Chef's delight(m)",
          revision: 15_000_000,
          amount: { base: 2, percentOfLevel: 5 },
          main: 'always',
          ironman: 'never',
        },
      ],
    })
  })

  it.each<[string, Record<string, BoostSource[]>, RegExp]>([
    ['a skill it does not know', { dancing: [boost()] }, /'dancing': not a skill the app knows/],
    ['a boost with no phrase', { fishing: [boost({ phrase: ' ' })] }, /no name or phrase/],
    ['a revision that is not one', { fishing: [boost({ rev: 0 })] }, /revision 0/],
    [
      'a size both flat and a share',
      { fishing: [boost({ base: 2, percent: 5 })] },
      /a size that is not flat or a base and a share/,
    ],
    [
      'no size',
      { fishing: [boost({ flat: undefined })] },
      /a size that is not flat or a base and a share/,
    ],
    [
      'a rule it does not know',
      { fishing: [boost({ main: 'sometimes' })] },
      /fishing: Super fishing potion main: a rule 'sometimes'/,
    ],
    [
      'a rule past 99',
      { fishing: [boost({ ironman: { skill: 'herblore', level: 100 } })] },
      /fishing: Super fishing potion ironman: herblore 100/,
    ],
  ])('refuses %s', (_case, source, problem) => {
    expect(problemsOf(() => buildBoosts(source)).join('\n')).toMatch(problem)
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

describe('buildGoals', () => {
  const quests = buildQuestFacts({
    'Fairytale I - Growing Pains': { kind: 'quest', page: 'Fairytale I', rev: 1 },
    'Fairytale II - Cure a Queen': {
      kind: 'quest',
      page: 'Fairytale II',
      rev: 1,
      startedMatters: true,
    },
  })
  const goal = (overrides: Partial<GoalSource> = {}): GoalSource => ({
    name: 'Fairy rings',
    gives: 'Travel by the fairy ring network.',
    quests: { 'Fairytale I - Growing Pains': 'finished', 'Fairytale II - Cure a Queen': 'started' },
    guide: { main: 62, ironman: 98 },
    ...overrides,
  })
  const build = (source: Record<string, GoalSource>) =>
    buildGoals(source, quests, ['Ardougne Easy', 'Ardougne Medium'])

  it('turns each goal into the app’s: its tree, tiers, levels and the guides’ steps', () => {
    expect(
      build({
        'fairy-rings': goal({
          diaries: ['Ardougne Easy'],
          levels: [{ skill: 'prayer', level: 70 }],
        }),
        'early-path': goal({ name: 'The early ironman path', ironmanOnly: true, guide: {} }),
      }),
    ).toEqual([
      {
        id: 'fairy-rings',
        name: 'Fairy rings',
        gives: 'Travel by the fairy ring network.',
        quests: {
          'Fairytale I - Growing Pains': 'finished',
          'Fairytale II - Cure a Queen': 'started',
        },
        diaries: ['Ardougne Easy'],
        levels: [{ skill: 'prayer', level: 70 }],
        allQuests: false,
        allDiaries: false,
        guide: { main: 62, ironman: 98 },
        ironmanOnly: false,
      },
      expect.objectContaining({
        id: 'early-path',
        guide: { main: null, ironman: null },
        ironmanOnly: true,
      }),
    ])
  })

  it.each<[string, Record<string, GoalSource>, RegExp]>([
    ['a goal with no words', { goal: goal({ gives: ' ' }) }, /goal goal: no name or words/],
    [
      'a quest that is not an entry',
      { goal: goal({ quests: { 'Fairytale III': 'finished' } }) },
      /goal goal: needs 'Fairytale III', not a quest entry/,
    ],
    [
      'a state it does not know',
      { goal: goal({ quests: { 'Fairytale I - Growing Pains': 'halfway' } }) },
      /goal goal: needs 'Fairytale I - Growing Pains' halfway/,
    ],
    [
      'a tier it does not know',
      { goal: goal({ diaries: ['Ardougne Master'] }) },
      /goal goal: needs tier 'Ardougne Master'/,
    ],
    ['a goal that needs nothing', { goal: goal({ quests: {} }) }, /goal goal: needs nothing/],
    [
      'a level past 99',
      { goal: goal({ levels: [{ skill: 'prayer', level: 100 }] }) },
      /goal goal: prayer 100/,
    ],
    ['a guide step of 0', { goal: goal({ guide: { main: 0 } }) }, /goal goal: guide step 0/],
    ['a guide it does not know', { goal: goal({ guide: { f2p: 3 } }) }, /goal goal: a guide 'f2p'/],
  ])('refuses %s', (_case, source, problem) => {
    expect(problemsOf(() => build(source)).join('\n')).toMatch(problem)
  })
})

import { describe, expect, it } from 'vitest'
import { METHODS } from '#shared/data/methods'
import { SKILL_KEYS, skillName } from '#shared/data/skills'
import {
  AFK_GUIDE_PATH,
  GUIDES_PATH,
  GUIDE_SKILLS,
  buildAfkGuide,
  buildGuideIndex,
  buildGuideLinks,
  buildSkillGuide,
  buildSkillGuides,
  describeHighlights,
  describeRate,
  describeRequirements,
  fastestListed,
  guideMethod,
  guideMethodCount,
  guidePath,
  isGuideSkill,
  wikiSources,
} from '#shared/domain/guides'
import { NO_REQUIREMENTS, parseRequirements } from '#shared/domain/requirements'
import { methodWith } from './helpers'

describe('describeRate', () => {
  it('gives a flat rate by the hour', () => {
    expect(describeRate(methodWith({ xpPerHour: 85_000 }))).toBe('≈ 85k an hour')
    expect(describeRate(methodWith({ xpPerHour: 1_250_000 }))).toBe('≈ 1.25M an hour')
    expect(describeRate(methodWith({ xpPerHour: 950 }))).toBe('≈ 950 an hour')
  })

  it('gives a rate that rises with level as its range', () => {
    const method = methodWith({
      xpPerHour: 34_000,
      rateBands: [
        { fromLevel: 35, xpPerHour: 34_000 },
        { fromLevel: 60, xpPerHour: 70_000 },
        { fromLevel: 80, xpPerHour: 93_000 },
      ],
    })
    expect(describeRate(method)).toBe('≈ 34k to 93k an hour')
  })

  it('does not call two rates that read the same a range', () => {
    const method = methodWith({
      xpPerHour: 34_100,
      rateBands: [
        { fromLevel: 1, xpPerHour: 34_100 },
        { fromLevel: 50, xpPerHour: 34_400 },
      ],
    })
    expect(describeRate(method)).toBe('≈ 34k an hour')
  })

  it('leaves a band with no rate out of the range', () => {
    const method = methodWith({
      xpPerHour: 0,
      rateBands: [
        { fromLevel: 1, xpPerHour: 0 },
        { fromLevel: 30, xpPerHour: 50_000 },
      ],
    })
    expect(describeRate(method)).toBe('≈ 50k an hour')
  })

  it('counts a timed run by the run, whatever its hourly figure', () => {
    const run = methodWith({
      xpPerHour: 2_400_000,
      timedRun: { xpPerRun: 12_400, everyMinutes: 80 },
    })
    expect(describeRate(run)).toBe('≈ 12k a run')
  })

  it('falls back to the hourly figure for a timed run with no XP a run', () => {
    const run = methodWith({ xpPerHour: 40_000, timedRun: { xpPerRun: 0, everyMinutes: 50 } })
    expect(describeRate(run)).toBe('≈ 40k an hour')
  })

  it('says a rate worked out from the account depends on the account', () => {
    const method = methodWith({ xpPerHour: 0, computedRate: 'crab-melee' })
    expect(describeRate(method)).toBe('depends on your levels')
  })

  it('says so when the wiki gives no rate', () => {
    expect(describeRate(methodWith({ xpPerHour: 0 }))).toBe('no hourly rate')
  })
})

describe('describeRequirements', () => {
  it('is empty for a method that needs nothing', () => {
    expect(describeRequirements(NO_REQUIREMENTS)).toBe('')
  })

  it('lists quests, then levels, then diaries, then combat', () => {
    const requirements = parseRequirements(
      'q:Bone Voyage|Sins of the Father;s:farming 35,runecraft 77;d:Ardougne Medium;c:70',
    )
    expect(describeRequirements(requirements)).toBe(
      'Bone Voyage, Sins of the Father, 35 Farming, 77 Runecraft, Ardougne Medium diary, 70 combat',
    )
  })
})

describe('guideMethod', () => {
  it('puts a method into the words of a table row', () => {
    const method = methodWith({
      skill: 'farming',
      level: 32,
      name: 'Herb runs',
      note: 'Ranarrs or better.',
      intensity: 'semi',
      audience: 'iron',
      xpPerHour: 1_000_000,
      timedRun: { xpPerRun: 9_500, everyMinutes: 80 },
      requirements: parseRequirements('q:My Arm’s Big Adventure'),
    })
    expect(guideMethod(method)).toEqual({
      skill: 'farming',
      level: 32,
      name: 'Herb runs',
      note: 'Ranarrs or better.',
      isTimedRun: true,
      isTickPerfect: false,
      isInWilderness: false,
      rate: '≈ 10k a run',
      needs: 'My Arm’s Big Adventure',
      intensity: 'semi',
      audience: 'Ironmen',
    })
  })

  it('says when a method needs tick manipulation', () => {
    expect(guideMethod(methodWith({ tickPerfect: true })).isTickPerfect).toBe(true)
    expect(guideMethod(methodWith()).isTickPerfect).toBe(false)
  })

  it('says when a method is done in the Wilderness', () => {
    expect(guideMethod(methodWith({ inWilderness: true })).isInWilderness).toBe(true)
    expect(guideMethod(methodWith()).isInWilderness).toBe(false)
  })

  it('names who a method is for', () => {
    expect(guideMethod(methodWith({ audience: 'both' })).audience).toBe('Everyone')
    expect(guideMethod(methodWith({ audience: 'main' })).audience).toBe('Mains')
  })
})

describe('fastestListed', () => {
  const slow = methodWith({ name: 'Slow', xpPerHour: 20_000 })
  const banded = methodWith({
    name: 'Banded',
    level: 30,
    xpPerHour: 10_000,
    rateBands: [
      { fromLevel: 30, xpPerHour: 10_000 },
      { fromLevel: 70, xpPerHour: 90_000 },
    ],
  })

  it('judges a method by the best rate it ever reaches', () => {
    expect(fastestListed([slow, banded])).toBe(banded)
  })

  it('gives a tie to the earlier method', () => {
    const twin = methodWith({ name: 'Twin', level: 50, xpPerHour: 90_000 })
    expect(fastestListed([slow, banded, twin])).toBe(banded)
  })

  it('leaves out timed runs, rates worked out from the account, and methods with no rate', () => {
    const run = methodWith({
      xpPerHour: 5_000_000,
      timedRun: { xpPerRun: 9_000, everyMinutes: 80 },
    })
    const computed = methodWith({ xpPerHour: 0, computedRate: 'crab-ranged' })
    const unrated = methodWith({ xpPerHour: 0 })
    expect(fastestListed([run, computed, unrated])).toBeNull()
    expect(fastestListed([run, slow, computed])).toBe(slow)
  })

  it('only considers the methods it is asked about', () => {
    const afk = methodWith({ name: 'Idle', xpPerHour: 5_000, intensity: 'afk' })
    expect(fastestListed([slow, afk], (method) => method.intensity === 'afk')).toBe(afk)
  })
})

describe('describeHighlights', () => {
  const active = methodWith({ name: 'Bloodwood trees', level: 77, xpPerHour: 170_000 })
  const afk = methodWith({
    name: 'Rosewood trees',
    level: 92,
    xpPerHour: 88_000,
    intensity: 'afk',
  })

  it('names the fastest method and the best AFK one', () => {
    expect(describeHighlights([active, afk])).toBe(
      'The fastest listed is Bloodwood trees at up to about 170k XP an hour, from level 77. ' +
        'The best AFK option is Rosewood trees at up to about 88k XP an hour, from level 92.',
    )
  })

  it('names a method once when the fastest is itself AFK', () => {
    expect(describeHighlights([afk])).toBe(
      'The fastest listed is Rosewood trees at up to about 88k XP an hour, from level 92.',
    )
  })

  it('says so when no method is AFK', () => {
    expect(describeHighlights([active])).toBe(
      'The fastest listed is Bloodwood trees at up to about 170k XP an hour, from level 77. ' +
        'None of them is fully AFK.',
    )
  })

  it('claims no best AFK option when the AFK methods have no rate', () => {
    const unratedAfk = methodWith({ xpPerHour: 0, intensity: 'afk' })
    expect(describeHighlights([active, unratedAfk])).toBe(
      'The fastest listed is Bloodwood trees at up to about 170k XP an hour, from level 77.',
    )
  })

  it('has nothing to say about methods with no rates at all', () => {
    expect(describeHighlights([methodWith({ xpPerHour: 0, intensity: 'afk' })])).toBe('')
  })

  describe('with a method that needs tick manipulation', () => {
    const tick = methodWith({
      name: 'Teak trees (1.5-tick)',
      level: 35,
      xpPerHour: 203_000,
      tickPerfect: true,
    })

    it('leads with the fastest that does not, then names the faster one in its own sentence', () => {
      expect(describeHighlights([tick, active, afk])).toBe(
        'Without tick manipulation, the fastest listed is Bloodwood trees at up to about 170k XP an hour, from level 77. ' +
          'With tick manipulation, the fastest listed is Teak trees (1.5-tick) at up to about 203k XP an hour, from level 35. ' +
          'The best AFK option is Rosewood trees at up to about 88k XP an hour, from level 92.',
      )
    })

    it('does not mention it when it is no faster', () => {
      const expected =
        'The fastest listed is Bloodwood trees at up to about 170k XP an hour, from level 77. ' +
        'The best AFK option is Rosewood trees at up to about 88k XP an hour, from level 92.'
      const slower = { ...tick, xpPerHour: 93_000 }
      const tied = { ...tick, xpPerHour: 170_000 }
      expect(describeHighlights([slower, active, afk])).toBe(expected)
      expect(describeHighlights([tied, active, afk])).toBe(expected)
    })

    it('still names an AFK method once when it is the fastest without tick manipulation', () => {
      expect(describeHighlights([tick, afk])).toBe(
        'Without tick manipulation, the fastest listed is Rosewood trees at up to about 88k XP an hour, from level 92. ' +
          'With tick manipulation, the fastest listed is Teak trees (1.5-tick) at up to about 203k XP an hour, from level 35.',
      )
    })

    it('names it alone when no other method has a rate', () => {
      expect(describeHighlights([tick, methodWith({ xpPerHour: 0 })])).toBe(
        'With tick manipulation, the fastest listed is Teak trees (1.5-tick) at up to about 203k XP an hour, from level 35. ' +
          'None of them is fully AFK.',
      )
    })
  })
})

describe('wikiSources', () => {
  it('lists each page once, in alphabetical order, with its address on the wiki', () => {
    const methods = [
      methodWith({ source: 'Woodcutting training' }),
      methodWith({ source: 'Ironman Guide/Woodcutting' }),
      methodWith({ source: 'Woodcutting training' }),
    ]
    expect(wikiSources(methods)).toEqual([
      {
        title: 'Ironman Guide/Woodcutting',
        url: 'https://oldschool.runescape.wiki/w/Ironman_Guide/Woodcutting',
      },
      {
        title: 'Woodcutting training',
        url: 'https://oldschool.runescape.wiki/w/Woodcutting_training',
      },
    ])
  })
})

describe('the skills that have a guide', () => {
  it('are the 23 skills with methods, in alphabetical order', () => {
    expect(GUIDE_SKILLS).toHaveLength(23)
    expect(GUIDE_SKILLS).toEqual([...GUIDE_SKILLS].sort())
    expect(GUIDE_SKILLS).toEqual(
      expect.arrayContaining(SKILL_KEYS.filter((skill) => METHODS[skill].length > 0)),
    )
  })

  it('do not include Hitpoints, which has no methods of its own', () => {
    expect(isGuideSkill('hitpoints')).toBe(false)
    expect(isGuideSkill('mining')).toBe(true)
    expect(isGuideSkill('afk')).toBe(false)
    expect(() => buildSkillGuide('hitpoints')).toThrow("There is no guide for 'hitpoints'")
  })
})

describe('a skill guide', () => {
  // the fastest method when one can be named, with or without tick manipulation when the two
  // differ, then the best AFK one or the lack of any
  const PEAK = String.raw`.+? at up to about [\d.]+[kM]? XP an hour, from level \d+\.`
  const FASTEST = `The fastest listed is ${PEAK}|Without tick manipulation, the fastest listed is ${PEAK} With tick manipulation, the fastest listed is ${PEAK}`
  const HIGHLIGHTS = new RegExp(
    `^(${FASTEST})?( ?The best AFK option is ${PEAK}| ?None of them is fully AFK\\.)?$`,
  )

  it('builds for every skill that has one', () => {
    const guides = buildSkillGuides()
    expect(guides.map((guide) => guide.skill)).toEqual(GUIDE_SKILLS)
    for (const guide of guides) {
      const name = skillName(guide.skill)
      const count = METHODS[guide.skill].length
      expect(guide.path).toBe(`/guides/${guide.skill}/`)
      expect(guide.title).toBe(
        `OSRS ${name} training methods 1-99: XP rates for mains and ironmen | Long Game`,
      )
      expect(guide.heading).toBe(`${name} training methods, level 1 to 99`)
      expect(guide.description).toMatch(
        new RegExp(
          `^${name} training in OSRS: ${count} methods from level \\d+ to 99 with XP rates`,
        ),
      )
      expect(guide.description.length).toBeLessThanOrEqual(158)
      expect(guide.facts).toMatch(
        new RegExp(
          `^${count} ways to train ${name} in Old School RuneScape, from level \\d+ to 99,`,
        ),
      )
      expect(guide.highlights).toMatch(HIGHLIGHTS)
      expect(guide.methods).toHaveLength(count)
      expect(guide.sources.length).toBeGreaterThan(0)
    }
  })

  it('never calls a method that needs tick manipulation the fastest without saying so', () => {
    // a reader may never have heard of tick manipulation, so a method that needs it is named as such
    const LEAD = /^(?:Without tick manipulation, the|The) fastest listed is (.+?) at up to about /
    const TICK = /With tick manipulation, the fastest listed is (.+?) at up to about /
    let tickSentences = 0
    for (const guide of buildSkillGuides()) {
      const isTickPerfect = (name: string): boolean | undefined =>
        METHODS[guide.skill].find((method) => method.name === name)?.tickPerfect
      const leadName = LEAD.exec(guide.highlights)?.[1]
      const tickName = TICK.exec(guide.highlights)?.[1]
      if (leadName) expect(isTickPerfect(leadName), `${guide.skill}: ${leadName}`).toBe(false)
      if (tickName) {
        expect(isTickPerfect(tickName), `${guide.skill}: ${tickName}`).toBe(true)
        tickSentences += 1
      }
    }
    // not an empty check: Cooking, Magic, Mining and Woodcutting each list one faster than the rest
    expect(tickSentences).toBeGreaterThan(0)
  })

  it('keeps the methods in the order of the data: lowest level first', () => {
    for (const guide of buildSkillGuides()) {
      expect(guide.methods.map((method) => method.name)).toEqual(
        METHODS[guide.skill].map((method) => method.name),
      )
      const levels = guide.methods.map((method) => method.level)
      expect(levels).toEqual([...levels].sort((first, second) => first - second))
    }
  })

  it('gives every method a rate in words and a known audience', () => {
    for (const method of buildSkillGuides().flatMap((guide) => guide.methods)) {
      expect(method.rate).toMatch(
        /^(≈ [\d.]+[kM]? (to [\d.]+[kM]? )?an hour|≈ [\d.]+[kM]? a run|depends on your levels|no hourly rate)$/,
      )
      expect(['Everyone', 'Mains', 'Ironmen']).toContain(method.audience)
    }
  })

  it('links every source to a page of the wiki', () => {
    for (const source of buildSkillGuides().flatMap((guide) => guide.sources)) {
      expect(source.url).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/w\/\S+$/)
    }
  })
})

describe('the AFK guide', () => {
  const guide = buildAfkGuide()

  it('holds every AFK method and nothing else', () => {
    const afkCount = GUIDE_SKILLS.flatMap((skill) => METHODS[skill]).filter(
      (method) => method.intensity === 'afk',
    ).length
    expect(guide.methods).toHaveLength(afkCount)
    expect(guide.methods.every((method) => method.intensity === 'afk')).toBe(true)
  })

  it('goes skill by skill, in the order of the guides', () => {
    const skills = [...new Set(guide.methods.map((method) => method.skill))]
    expect(skills).toEqual(GUIDE_SKILLS.filter((skill) => skills.includes(skill)))
  })

  it('counts its methods and skills in its own words', () => {
    const skillCount = new Set(guide.methods.map((method) => method.skill)).size
    expect(guide.path).toBe(AFK_GUIDE_PATH)
    expect(guide.title).toBe('OSRS AFK training methods for every skill | Long Game')
    expect(guide.heading).toBe('AFK training methods for every skill')
    expect(guide.description).toBe(
      `Every AFK training method in Old School RuneScape, skill by skill: ${guide.methods.length} methods with levels, XP rates and requirements.`,
    )
    expect(guide.facts).toBe(
      `${guide.methods.length} methods across ${skillCount} skills that need a click every few minutes at most, with the level each one opens at and the XP an hour the wiki gives.`,
    )
  })
})

describe('the guide index', () => {
  const index = buildGuideIndex()

  it('links to every skill guide and then to the AFK page', () => {
    expect(index.links).toEqual(buildGuideLinks())
    expect(index.links.map((link) => link.path)).toEqual([
      ...GUIDE_SKILLS.map(guidePath),
      AFK_GUIDE_PATH,
    ])
    expect(index.links.at(-1)).toEqual({
      path: AFK_GUIDE_PATH,
      label: 'Every AFK method',
      skill: null,
      methodCount: buildAfkGuide().methods.length,
    })
  })

  it('counts each skill guide and the whole', () => {
    for (const link of index.links) {
      if (link.skill) expect(link.methodCount).toBe(METHODS[link.skill].length)
    }
    const total = guideMethodCount()
    expect(total).toBe(GUIDE_SKILLS.reduce((sum, skill) => sum + METHODS[skill].length, 0))
    expect(index.path).toBe(GUIDES_PATH)
    expect(index.title).toBe('OSRS training guides: every method for every skill | Long Game')
    expect(index.heading).toBe('Training methods for every skill')
    expect(index.description).toBe(
      `Training methods for all 23 trainable skills in Old School RuneScape: ${total} methods with levels, XP rates, AFK options and ironman routes.`,
    )
    expect(index.facts).toBe(
      `${total} methods across 23 skills, each with the level it opens at, the XP an hour the wiki gives, how much attention it takes and what it needs. Hitpoints trains itself through combat.`,
    )
  })
})

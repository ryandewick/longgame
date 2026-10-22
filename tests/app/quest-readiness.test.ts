import { describe, expect, it } from 'vitest'
import type { Boost } from '#shared/types/boost'
import type { SkillKey } from '#shared/types/skill'
import { BOOSTS } from '#shared/data/boosts'
import type { Readiness, ReadinessGap } from '#shared/domain/readiness'
import {
  choiceWords,
  diaryNextRows,
  gapInFull,
  gapWords,
  readinessLine,
  readinessSentence,
  rowReadiness,
} from '../../app/utils/quest-readiness'
import { accountWith, freshAccount } from '../domain/helpers'

/** A boost from the app's data, by its skill and name. */
function boost(skill: SkillKey, name: string): Boost {
  const found = BOOSTS[skill]?.find((each) => each.name === name)
  if (!found) throw new Error(`no ${name} for ${skill}`)
  return found
}

const missing = (...gaps: ReadinessGap[]): Readiness => ({ missing: gaps, boosted: [] })

const skill = (
  name: SkillKey,
  level: number,
  has: number,
  extra: Partial<Extract<ReadinessGap, { kind: 'skill' }>> = {},
): ReadinessGap => ({
  kind: 'skill',
  skill: name,
  level,
  has,
  boostable: false,
  nearestBoost: null,
  raiments: null,
  ...extra,
})

describe('readinessLine', () => {
  it('says Ready when nothing is missing', () => {
    expect(readinessLine(missing())).toBe('Ready')
  })

  it('names the boosts a ready quest counts on, each once', () => {
    const potion = { boost: boost('fishing', 'Super fishing potion'), size: 6 }
    const pie = { boost: boost('herblore', 'Botanical pie'), size: 4 }
    expect(
      readinessLine({
        missing: [],
        boosted: [{ skill: 'fishing', level: 62, has: 57, boost: potion }],
      }),
    ).toBe('Ready with a super fishing potion')
    expect(
      readinessLine({
        missing: [],
        boosted: [
          { skill: 'fishing', level: 53, has: 50, boost: potion },
          { skill: 'herblore', level: 45, has: 41, boost: pie },
          { skill: 'fishing', level: 53, has: 50, boost: potion },
        ],
      }),
    ).toBe('Ready with a super fishing potion and a botanical pie')
  })

  it('names up to three needs and counts the rest', () => {
    const quest = (name: string): ReadinessGap => ({
      kind: 'quest',
      quest: name,
      state: 'finished',
    })
    expect(readinessLine(missing(quest('Grim Tales'), skill('prayer', 70, 52)))).toBe(
      'Needs Grim Tales and 70 Prayer',
    )
    expect(
      readinessLine(
        missing(
          quest('Grim Tales'),
          quest('The Slug Menace'),
          skill('prayer', 70, 52),
          skill('slayer', 72, 70),
        ),
      ),
    ).toBe('Needs Grim Tales, The Slug Menace, 70 Prayer and 1 more')
  })

  it('puts the lower tiers of a diary as one need', () => {
    const lower = (diary: string): ReadinessGap => ({ kind: 'lower-tier', diary })
    expect(readinessLine(missing(lower('Wilderness Easy')))).toBe('Needs Wilderness Easy first')
    expect(readinessLine(missing(lower('Wilderness Easy'), lower('Wilderness Medium')))).toBe(
      'Needs Wilderness Easy and Medium first',
    )
    expect(
      readinessLine(
        missing(
          lower('Wilderness Easy'),
          lower('Wilderness Medium'),
          lower('Wilderness Hard'),
          skill('magic', 96, 72),
        ),
      ),
    ).toBe('Needs the three tiers below it first and 96 Magic')
  })
})

describe('gapWords', () => {
  it.each<[string, ReadinessGap, string]>([
    [
      'a quest to start',
      { kind: 'quest', quest: 'Ratcatchers', state: 'started' },
      'Ratcatchers started',
    ],
    ['a level', skill('fishing', 62, 57), '62 Fishing'],
    ['quest points', { kind: 'quest-points', needed: 175, has: 120 }, '175 quest points'],
    ['a combat level', { kind: 'combat', level: 85, has: 69 }, 'combat level 85'],
    ['Kudos', { kind: 'kudos', needed: 153, withinReach: 95 }, '153 Kudos'],
    ['every quest', { kind: 'all-quests', left: 80 }, 'every quest'],
    [
      'an ironman’s need for an item',
      {
        kind: 'ironman',
        need: 'a mithril grapple',
        options: [
          [
            { skill: 'fletching', level: 59 },
            { skill: 'smithing', level: 59 },
          ],
          [{ skill: 'firemaking', level: 35 }],
        ],
      },
      'a mithril grapple to make',
    ],
    [
      'an ironman’s level for a tier',
      { kind: 'ironman', need: null, options: [[{ skill: 'hunter', level: 69 }]] },
      '69 Hunter as an ironman',
    ],
  ])('words %s', (_case, gap, words) => {
    expect(gapWords(gap)).toBe(words)
  })

  it('words an either-or need as its options', () => {
    expect(
      choiceWords({
        options: [
          [{ kind: 'combat', level: 100 }],
          [{ kind: 'skill', skill: 'slayer', level: 99, boostable: false }],
          [
            { kind: 'quest', quest: "Legends' Quest", state: 'started' },
            { kind: 'other', text: 'a machete' },
          ],
        ],
        note: null,
      }),
    ).toBe("combat level 100 or 99 Slayer or Legends' Quest started and a machete")
  })
})

describe('gapInFull', () => {
  it('gives the level the account has, and the boost that would cover it', () => {
    const potion = boost('fishing', 'Super fishing potion')
    const gap = skill('fishing', 62, 57, {
      boostable: true,
      nearestBoost: { boost: potion, size: 6, unlockedBy: { skill: 'herblore', level: 62 } },
    })
    expect(gapInFull(gap)).toBe(
      '62 Fishing (you have 57; a super fishing potion covers it once you have 62 Herblore)',
    )
  })

  it('gives the Raiments of the Eye route beside a Runecraft level', () => {
    expect(gapInFull(skill('runecraft', 78, 60, { raiments: { level: 52, pieces: 2 } }))).toBe(
      '78 Runecraft (you have 60; 52 is enough with 2 or more Raiments of the Eye pieces)',
    )
  })

  it('gives the quest points, combat level and Kudos the account has, and the quests left', () => {
    expect(gapInFull({ kind: 'quest-points', needed: 175, has: 120 })).toBe(
      '175 quest points (you have 120)',
    )
    expect(gapInFull({ kind: 'combat', level: 85, has: 69 })).toBe('combat level 85 (you have 69)')
    expect(gapInFull({ kind: 'kudos', needed: 153, withinReach: 95 })).toBe(
      '153 Kudos (your quests and the museum give 95 so far)',
    )
    expect(gapInFull({ kind: 'all-quests', left: 80 })).toBe('every quest (80 left)')
  })
})

describe('readinessSentence', () => {
  it('ends a ready one with a full stop', () => {
    expect(readinessSentence(missing())).toBe('Ready.')
  })

  it('lists every need with the account’s own figures', () => {
    expect(
      readinessSentence(
        missing(
          { kind: 'quest', quest: 'Tears of Guthix', state: 'finished' },
          skill('farming', 63, 55),
        ),
      ),
    ).toBe('Needs Tears of Guthix and 63 Farming (you have 55).')
  })

  it('says what an ironman has to make, and the levels that takes', () => {
    const grapple: ReadinessGap = {
      kind: 'ironman',
      need: 'a mithril grapple',
      options: [
        [
          { skill: 'fletching', level: 59 },
          { skill: 'smithing', level: 59 },
        ],
        [{ skill: 'firemaking', level: 35 }],
      ],
    }
    expect(readinessSentence(missing(skill('ranged', 62, 60), grapple))).toBe(
      'Needs 62 Ranged (you have 60) and a mithril grapple to make (59 Fletching and 59 Smithing, or 35 Firemaking).',
    )
  })

  it('separates the needs with semicolons when one has a comma of its own outside brackets', () => {
    const choice: ReadinessGap = {
      kind: 'choice',
      choice: {
        options: [
          [{ kind: 'other', text: 'a cooked oomlie wrap, or a palm leaf' }],
          [{ kind: 'combat', level: 90 }],
        ],
        note: null,
      },
    }
    expect(readinessSentence(missing(skill('cooking', 50, 40), choice))).toBe(
      'Needs 50 Cooking (you have 40); and a cooked oomlie wrap, or a palm leaf or combat level 90.',
    )
  })
})

describe('rowReadiness', () => {
  it('gives a row whether it is ready, its short line and its whole sentence', () => {
    expect(rowReadiness(missing())).toEqual({ ready: true, line: 'Ready', sentence: 'Ready.' })
    expect(rowReadiness(missing(skill('farming', 63, 55)))).toEqual({
      ready: false,
      line: 'Needs 63 Farming',
      sentence: 'Needs 63 Farming (you have 55).',
    })
  })
})

describe('diaryNextRows', () => {
  it('gives each diary its lowest tier not claimed, region by region', () => {
    // a claimed Ardougne Medium proves Ardougne Easy
    const rows = diaryNextRows(freshAccount({ diaries: ['Ardougne Easy', 'Ardougne Medium'] }))
    expect(rows).toHaveLength(12)
    expect(rows.slice(0, 3).map(({ region, diary }) => [region, diary])).toEqual([
      ['Ardougne', 'Ardougne Hard'],
      ['Desert', 'Desert Easy'],
      ['Falador', 'Falador Easy'],
    ])
  })

  it('says a ready tier is ready, and what it still has to build up', () => {
    const account = accountWith({ everySkill: 99, allQuests: true, diaries: ['Karamja Easy'] })
    expect(diaryNextRows(account).find(({ region }) => region === 'Karamja')).toEqual({
      region: 'Karamja',
      diary: 'Karamja Medium',
      ready: true,
      line: 'Ready; still to build: 100% favour in Tai Bwo Wannai (Tai Bwo Wannai Cleanup)',
      sentence: 'Ready. Still to build: 100% favour in Tai Bwo Wannai (Tai Bwo Wannai Cleanup).',
    })
  })

  it('says what a tier still needs, and leaves what it has to build up until the rest is done', () => {
    const diaries = ['Western Provinces Easy', 'Western Provinces Medium', 'Western Provinces Hard']
    const row = diaryNextRows(freshAccount({ diaries })).find(
      ({ region }) => region === 'Western Provinces',
    )
    expect(row?.diary).toBe('Western Provinces Elite')
    expect(row?.ready).toBe(false)
    expect(row?.line).toMatch(/^Needs /)
    expect(row?.line).not.toMatch(/still to build/)
  })

  it('says when all four tiers of a diary are claimed', () => {
    expect(diaryNextRows(accountWith({ allDiaries: true }))[0]).toEqual({
      region: 'Ardougne',
      diary: null,
      ready: false,
      line: 'All four tiers claimed',
      sentence: 'All four tiers claimed.',
    })
  })
})

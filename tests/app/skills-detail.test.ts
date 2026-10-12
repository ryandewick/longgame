import { describe, expect, it } from 'vitest'
import type { Method } from '#shared/types/method'
import type { Quest } from '#shared/types/quest'
import type { MissingRequirement } from '#shared/types/requirement'
import type { SkillKey } from '#shared/types/skill'
import { QUESTS } from '#shared/data/quests'
import type { MethodOption } from '#shared/domain/methods'
import { MAX_XP } from '#shared/domain/xp'
import {
  bestNowSentence,
  nextUnlockSentence,
  questsOwingSentence,
  questsOwingXp,
  skillDetailParagraphs,
  skillXpSentence,
  type TextSegment,
} from '~~/app/utils/skill-detail'
import { accountWith, methodWith } from '../domain/helpers'
import { fixtureAccount, fixturePace, insightFor, insightWith } from './skills-fixture'

/** A sentence as it reads, with the strong runs in [brackets]. */
const read = (segments: readonly TextSegment[] | null): string | null =>
  segments?.map((segment) => (segment.strong ? `[${segment.text}]` : segment.text)).join('') ?? null

const optionWith = (
  method: Partial<Method>,
  changes: Partial<Omit<MethodOption, 'method'>> = {},
): MethodOption => ({
  method: methodWith(method),
  xpPerHour: 10_000,
  xpPerRun: 0,
  missing: [],
  unlocked: true,
  ...changes,
})

const questWith = (name: string, fixedXp: Quest['fixedXp']): Quest => ({
  name,
  fixedXp,
  skillLevelsNeeded: {},
  miniquest: false,
})

const account = fixtureAccount()
const fixtureParagraphs = (skill: SkillKey) =>
  skillDetailParagraphs(
    insightFor(account, skill),
    true,
    fixturePace(skill),
    questsOwingXp(account, skill, QUESTS),
  ).map(read)

describe('skillXpSentence', () => {
  it('gives the XP banked, the XP to 99 and the XP to the next level', () => {
    expect(skillXpSentence({ level: 74, xp: 1_161_433 })).toBe(
      '1,161,433 xp. 11,872,998 to 99, 49k to 75.',
    )
    expect(skillXpSentence({ level: 1, xp: 0 })).toBe('0 xp. 13,034,431 to 99, 83 to 2.')
  })

  it('says a skill at 99 is maxed, whatever XP it has gone on to', () => {
    expect(skillXpSentence({ level: 99, xp: 13_080_000 })).toBe('13,080,000 xp. Maxed.')
  })
})

describe('bestNowSentence', () => {
  it('names the method, its rate and the hours it leaves', () => {
    const insight = insightWith({
      hoursLeft: 124.6,
      fastestMethod: optionWith({ name: 'Sulliusceps' }, { xpPerHour: 86_300 }),
    })
    expect(read(bestNowSentence(insight, false, 0))).toBe(
      'Best now: [Sulliusceps] at ≈86k/h, about 125 h to 99.',
    )
  })

  it('calls a rate worked out from the account an estimate', () => {
    const insight = insightWith({
      hoursLeft: 121,
      fastestMethod: optionWith(
        { name: 'Gemstone Crab', xpPerHour: 0, computedRate: 'crab-ranged' },
        { xpPerHour: 47_250 },
      ),
    })
    expect(read(bestNowSentence(insight, false, 0))).toBe(
      'Best now: [Gemstone Crab] at an estimated 47k/h, about 121 h to 99.',
    )
  })

  it('counts a skill trained by runs in days of runs', () => {
    const insight = insightWith({
      skill: 'farming',
      hoursLeft: 30,
      daysLeft: 49.6,
      fastestMethod: optionWith(
        { name: 'Hardwood tree runs', timedRun: { xpPerRun: 20_000, everyMinutes: 3840 } },
        { xpPerHour: 1_400_000, xpPerRun: 20_000 },
      ),
    })
    expect(read(bestNowSentence(insight, false, 0))).toBe(
      'Best now: [Hardwood tree runs] at ≈1.4M/h of time spent on the runs, ' +
        'about 50 days at one of each run a day to 99.',
    )
  })

  it('owns up to a rough figure', () => {
    const insight = insightWith({ isRough: true, fastestMethod: optionWith({ name: 'Mine' }) })
    expect(read(bestNowSentence(insight, false, 0))).toBe(
      'Best now: [Mine] at ≈10k/h, about 100 h to 99. ' +
        'The wiki gives no hourly rate for part of that, so it is a rough figure.',
    )
  })

  it('leaves the rate out when the best method has none', () => {
    const insight = insightWith({
      isRough: true,
      fastestMethod: optionWith({ name: 'Nieve or Steve' }, { xpPerHour: 0 }),
    })
    expect(read(bestNowSentence(insight, false, 0))).toBe(
      'Best now: [Nieve or Steve], about 100 h to 99. ' +
        'The wiki gives no hourly rate for part of that, so it is a rough figure.',
    )
  })

  it('warns an ironman, and only an ironman, when the rate runs on their own supplies', () => {
    const insight = insightWith({
      fastestMethod: optionWith({ name: 'Mine', usesOwnSupplies: true }),
    })
    expect(read(bestNowSentence(insight, true, 0))).toBe(
      'Best now: [Mine] at ≈10k/h, about 100 h to 99. ' +
        'That rate only holds while your own supplies last.',
    )
    expect(read(bestNowSentence(insight, false, 0))).toBe(
      'Best now: [Mine] at ≈10k/h, about 100 h to 99.',
    )
  })

  it('gives every caveat in turn, then the pace', () => {
    const insight = insightWith({
      isRough: true,
      fastestMethod: optionWith({ name: 'Mine', usesOwnSupplies: true }),
    })
    expect(read(bestNowSentence(insight, true, 11_400))).toBe(
      'Best now: [Mine] at ≈10k/h, about 100 h to 99. ' +
        'The wiki gives no hourly rate for part of that, so it is a rough figure. ' +
        'That rate only holds while your own supplies last. ' +
        'Your 7-day pace is 11k a day.',
    )
  })

  it('says so when no method is open', () => {
    expect(read(bestNowSentence(insightWith(), false, 0))).toBe(
      'No method available yet. Check the requirements in the table.',
    )
    expect(read(bestNowSentence(insightWith(), false, 250))).toBe(
      'No method available yet. Check the requirements in the table. Your 7-day pace is 250 a day.',
    )
  })

  it('says a skill that comes with combat needs no plan', () => {
    const insight = insightWith({ skill: 'hitpoints', hoursLeft: 0 })
    expect(read(bestNowSentence(insight, true, 7_200))).toBe(
      'Trains itself through combat. It needs no plan of its own. Your 7-day pace is 7k a day.',
    )
  })

  it('leaves out a pace that is not a gain', () => {
    const insight = insightWith({ skill: 'hitpoints' })
    expect(read(bestNowSentence(insight, true, -5))).toBe(
      'Trains itself through combat. It needs no plan of its own.',
    )
  })
})

describe('nextUnlockSentence', () => {
  const missingQuest: MissingRequirement = { kind: 'quest', quest: 'Sins of the Father' }

  it('is null when nothing is left to unlock', () => {
    expect(nextUnlockSentence(insightWith())).toBeNull()
  })

  it('gives the level when the level is what is missing', () => {
    const insight = insightWith({
      nextUnlock: optionWith({ name: 'Granite', level: 60 }, { unlocked: false }),
    })
    expect(read(nextUnlockSentence(insight))).toBe('Next unlock: [Granite] at level 60.')
  })

  it('gives what the account lacks when the level is already reached', () => {
    const insight = insightWith({
      stat: { level: 74, xp: 1_161_433 },
      nextUnlock: optionWith(
        { name: 'Blisterwood tree', level: 62 },
        { unlocked: false, missing: [missingQuest] },
      ),
    })
    expect(read(nextUnlockSentence(insight))).toBe(
      'Next unlock: [Blisterwood tree], needs Sins of the Father.',
    )
  })

  it('gives both, and every requirement in the order the rules report them', () => {
    const insight = insightWith({
      nextUnlock: optionWith(
        { name: 'Blast mine', level: 75 },
        {
          unlocked: false,
          missing: [
            missingQuest,
            { kind: 'skill', skill: 'firemaking', level: 50 },
            { kind: 'diary', diary: 'Kourend & Kebos Hard' },
            { kind: 'combat', level: 100 },
          ],
        },
      ),
    })
    expect(read(nextUnlockSentence(insight))).toBe(
      'Next unlock: [Blast mine] at level 75, ' +
        'needs Sins of the Father, 50 Firemaking, Kourend & Kebos Hard diary, 100 combat.',
    )
  })
})

describe('questsOwingXp', () => {
  const quests = [
    questWith('Small', { mining: 2_000 }),
    questWith('Other skill', { fishing: 90_000 }),
    questWith('Large', { mining: 60_000, smithing: 5_000 }),
    questWith('Done', { mining: 40_000 }),
  ]

  it('lists the unfinished quests that pay into the skill, the most XP first', () => {
    const player = accountWith({ quests: ['Done'] })
    expect(questsOwingXp(player, 'mining', quests)).toEqual([
      { name: 'Large', xp: 60_000 },
      { name: 'Small', xp: 2_000 },
    ])
  })

  it('lists none for a player with the quest cape', () => {
    expect(questsOwingXp(accountWith({ allQuests: true }), 'mining', quests)).toEqual([])
  })
})

describe('questsOwingSentence', () => {
  it('is null when no quest owes XP', () => {
    expect(questsOwingSentence([])).toBeNull()
  })

  it('names each quest with its XP', () => {
    expect(read(questsOwingSentence([{ name: 'Grim Tales', xp: 60_000 }]))).toBe(
      'Quests still owing XP here: [Grim Tales] 60k.',
    )
  })

  it('stops after five', () => {
    const owing = [7, 6, 5, 4, 3, 2, 1].map((thousands) => ({
      name: `Quest ${thousands}`,
      xp: thousands * 1000,
    }))
    expect(read(questsOwingSentence(owing))).toBe(
      'Quests still owing XP here: [Quest 7] 7k, [Quest 6] 6k, [Quest 5] 5k, [Quest 4] 4k, [Quest 3] 3k.',
    )
  })
})

describe('skillDetailParagraphs', () => {
  it('writes the Skills detail for Woodcutting on the fixture account', () => {
    expect(fixtureParagraphs('woodcutting')).toEqual([
      '1,161,433 xp. 11,872,998 to 99, 49k to 75.',
      'Best now: [Sulliusceps] at ≈86k/h, about 125 h to 99. Your 7-day pace is 11k a day.',
      'Next unlock: [Blisterwood tree], needs Sins of the Father.',
      'Quests still owing XP here: [Grim Tales] 60k, [Song of the Elves] 40k, ' +
        '[The Fremennik Isles] 10k, [The Ribbiting Tale of a Lily Pad Labour Dispute] 2k.',
    ])
  })

  it('writes the Methods detail for Ranged on the fixture account', () => {
    expect(fixtureParagraphs('ranged')).toEqual([
      '265,265 xp. 12,769,166 to 99, 8k to 60.',
      'Best now: [Gemstone Crab] at an estimated 48k/h, about 192 h to 99. ' +
        'That rate only holds while your own supplies last. Your 7-day pace is 7k a day.',
      'Next unlock: [Brutus], needs The Ides of Milk.',
    ])
  })

  it('says only that a skill at 99 is maxed', () => {
    expect(fixtureParagraphs('thieving')).toHaveLength(1)
    expect(fixtureParagraphs('thieving')[0]).toMatch(/ xp\. Maxed\.$/)
  })

  it('leaves out the sentences that have nothing to say', () => {
    const insight = insightWith({ fastestMethod: optionWith({ name: 'Mine' }) })
    expect(skillDetailParagraphs(insight, false, 0, []).map(read)).toEqual([
      '101,333 xp. 12,933,098 to 99, 11k to 51.',
      'Best now: [Mine] at ≈10k/h, about 100 h to 99.',
    ])
  })

  it('still lists the quests that pay into a skill that comes with combat', () => {
    const insight = insightWith({ skill: 'hitpoints', hoursLeft: 0 })
    const paragraphs = skillDetailParagraphs(insight, true, 0, [
      { name: 'Dream Mentor', xp: 15_000 },
    ])
    expect(paragraphs.map(read).slice(1)).toEqual([
      'Trains itself through combat. It needs no plan of its own.',
      'Quests still owing XP here: [Dream Mentor] 15k.',
    ])
  })

  it('does not plan for a skill that is done, even with a method still locked', () => {
    const insight = insightWith({
      stat: { level: 99, xp: MAX_XP },
      hoursLeft: 0,
      nextUnlock: optionWith({ name: 'Locked' }, { unlocked: false }),
    })
    const paragraphs = skillDetailParagraphs(insight, false, 500, [{ name: 'Owing', xp: 1000 }])
    expect(paragraphs.map(read)).toEqual(['13,034,431 xp. Maxed.'])
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Account } from '#shared/types/account'
import type { Method } from '#shared/types/method'
import type { Mood, Session, SkillBlock } from '#shared/types/session'
import type { SkillKey } from '#shared/types/skill'
import { SKILL_KEYS } from '#shared/data/skills'
import { WILDCARDS } from '#shared/data/wildcards'
import { hoursLeft } from '#shared/domain/estimates'
import { methodOptions } from '#shared/domain/methods'
import type { MethodOption } from '#shared/domain/methods'
import {
  activityOf,
  dealSession,
  fittingMethods,
  methodForBlock,
  pickWeighted,
  skillWeight,
  skillsInPlay,
  skillsWithMethod,
  slotPreferences,
  swapBlock,
} from '#shared/domain/planner'
import type { DealRequest } from '#shared/domain/planner'
import type { QuestStepPick } from '#shared/domain/quest-step'
import { dueResets } from '#shared/domain/resets'
import { accountWith, methodWith, seededRandom } from './helpers'

vi.mock('#shared/data/methods', () => import('./sample-methods'))

const NOW = Date.UTC(2026, 9, 10, 20)
const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1)

/** A deal with everything optional switched off, for a level 1 main, unless the test says more. */
function deal(overrides: Partial<DealRequest> = {}) {
  return dealSession({
    account: accountWith(),
    minutes: 120,
    mood: 'balanced',
    includeResets: false,
    includeWildcard: false,
    questStep: null,
    recentSkills: [],
    resetLog: {},
    now: NOW,
    random: seededRandom(1),
    ...overrides,
  })
}

const skillBlocks = (session: Session): SkillBlock[] =>
  session.blocks.filter((block) => block.kind === 'skill')

const optionNamed = (account: Account, skill: SkillKey, name: string): MethodOption => {
  const option = methodOptions(account, skill).find((candidate) => candidate.method.name === name)
  if (!option) throw new Error(`The sample table has no ${skill} method called ${name}`)
  return option
}

/** Every skill but these is excluded. */
const onlyInPlay = (...skills: SkillKey[]): SkillKey[] =>
  SKILL_KEYS.filter((skill) => !skills.includes(skill))

describe('slotPreferences', () => {
  it('allows only AFK methods on an AFK night', () => {
    expect(slotPreferences('afk', 0, false)).toEqual([['afk']])
    expect(slotPreferences('afk', 5, true)).toEqual([['afk']])
  })

  it('allows only active methods on a full-attention night', () => {
    expect(slotPreferences('active', 0, false)).toEqual([['active']])
    expect(slotPreferences('active', 3, true)).toEqual([['active']])
  })

  it('alternates active and AFK slots on a balanced night, semi-AFK filling in before the opposite', () => {
    expect(slotPreferences('balanced', 0, false)).toEqual([['active'], ['semi'], ['afk']])
    expect(slotPreferences('balanced', 1, false)).toEqual([['afk'], ['semi'], ['active']])
    expect(slotPreferences('balanced', 2, false)).toEqual([['active'], ['semi'], ['afk']])
  })

  it('leads with AFK instead when the coin says so', () => {
    expect(slotPreferences('balanced', 0, true)).toEqual([['afk'], ['semi'], ['active']])
    expect(slotPreferences('balanced', 1, true)).toEqual([['active'], ['semi'], ['afk']])
  })
})

describe('activityOf', () => {
  it('drops the style a method is done in', () => {
    expect(activityOf('Gemstone Crab with Dorgeshuun crossbow')).toBe('Gemstone Crab')
    expect(activityOf('Rock crabs with combat spells')).toBe('Rock crabs')
  })

  it('leaves other names alone', () => {
    expect(activityOf('Nightmare Zone')).toBe('Nightmare Zone')
    expect(activityOf('Withering herbs')).toBe('Withering herbs')
  })
})

describe('fittingMethods', () => {
  const names = (options: readonly MethodOption[]) => options.map((option) => option.method.name)

  it('keeps to the intensities asked for', () => {
    const miner = accountWith({ levels: { mining: 60 } })
    expect(names(fittingMethods(miner, 'mining', ['afk']))).toEqual(['Crashed stars'])
    expect(names(fittingMethods(miner, 'mining', ['semi']))).toEqual(['Motherlode Mine'])
    expect(names(fittingMethods(miner, 'mining', ['afk', 'semi']))).toEqual([
      'Crashed stars',
      'Motherlode Mine',
    ])
  })

  it('never offers quest-skip advice, a timed run or a locked method', () => {
    expect(fittingMethods(accountWith(), 'agility', ['active'])).toEqual([])
    expect(fittingMethods(accountWith(), 'farming', ['active'])).toEqual([])
    expect(names(fittingMethods(accountWith(), 'mining', ['active']))).toEqual(['Iron ore'])
  })

  it('offers the last unlocked method when the wiki rates none', () => {
    expect(names(fittingMethods(accountWith(), 'slayer', ['active']))).toEqual(['Turael'])
  })

  it('respects the budget and the tick preference', () => {
    expect(names(fittingMethods(accountWith({ budget: 'cheap' }), 'cooking', ['afk']))).toEqual([
      'Shrimp',
    ])
    expect(names(fittingMethods(accountWith({ tickPerfect: true }), 'mining', ['active']))).toEqual(
      ['Granite (3-tick)', 'Iron ore'],
    )
  })

  it('has nothing for a passive skill', () => {
    expect(fittingMethods(accountWith(), 'hitpoints', ['afk', 'semi', 'active'])).toEqual([])
  })
})

describe('methodForBlock', () => {
  it('takes the fastest method that fits', () => {
    expect(methodForBlock(accountWith(), 'cooking', ['afk'])?.method.name).toBe('Jugs of wine')
    expect(methodForBlock(accountWith(), 'ranged', ['afk'])?.method.name).toBe(
      'Crab with a crossbow',
    )
  })

  it('counts per-trip setup against a method in an AFK block', () => {
    // Nightmare Zone is 60k with setup, worth 45k to an AFK block; sand crabs are 50k without
    expect(methodForBlock(accountWith(), 'attack', ['afk'])?.method.name).toBe('Sand crabs')
  })

  it('passes over activities already in the session', () => {
    const taken = new Set(['Sand crabs'])
    expect(methodForBlock(accountWith(), 'attack', ['afk'], taken)?.method.name).toBe(
      'Nightmare Zone',
    )
  })

  it('treats every style of an activity as that activity', () => {
    expect(methodForBlock(accountWith(), 'ranged', ['afk'], new Set(['Crab']))).toBeNull()
    expect(methodForBlock(accountWith(), 'magic', ['afk'], new Set(['Crab']))).toBeNull()
  })

  it('counts supplies against a method for an ironman', () => {
    const ironman = accountWith({ type: 'iron' })
    // smelted ore is the only active method an ironman has, so it still wins its block
    expect(methodForBlock(ironman, 'smithing', ['active'])?.method.name).toBe('Smelted ore')
    // across intensities its 20k is worth 12k, still ahead of 10k cannonballs
    expect(methodForBlock(ironman, 'smithing', ['active', 'afk'])?.method.name).toBe('Smelted ore')
  })

  it('is null when nothing fits', () => {
    expect(methodForBlock(accountWith(), 'agility', ['afk'])).toBeNull()
  })

  describe('a method preferred to other activities', () => {
    const option = (
      name: string,
      xpPerHour: number,
      extra: Partial<Method> = {},
    ): MethodOption => ({
      method: methodWith({ skill: 'magic', name, xpPerHour, intensity: 'afk', ...extra }),
      xpPerHour,
      xpPerRun: 0,
      missing: [],
      unlocked: true,
    })
    const gemstone = option('Gemstone Crab with combat spells', 20_000, {
      preferredOver: ['Rock crabs', 'Frost crabs'],
    })
    const rock = option('Rock crabs with combat spells', 30_000)
    const frost = option('Frost crabs with fire spells', 35_000)
    const bandits = option('Blood bursting desert bandits', 120_000)
    const pick = (options: MethodOption[], taken: string[] = [], intensities = ['afk' as const]) =>
      methodForBlock(accountWith(), 'magic', intensities, new Set(taken), options)?.method.name

    it('wins an AFK block over the activities it names, whatever their rates', () => {
      expect(pick([rock, gemstone, frost])).toBe('Gemstone Crab with combat spells')
    })

    it('leaves other activities to compete on their rates', () => {
      expect(pick([rock, gemstone, frost, bandits])).toBe('Blood bursting desert bandits')
    })

    it('lets the others back in while it is locked or already in the session', () => {
      expect(pick([rock, { ...gemstone, unlocked: false }, frost])).toBe(
        'Frost crabs with fire spells',
      )
      expect(pick([rock, gemstone, frost], ['Gemstone Crab'])).toBe('Frost crabs with fire spells')
    })

    it('changes nothing outside an AFK block', () => {
      const semi = (chosen: MethodOption) => ({
        ...chosen,
        method: { ...chosen.method, intensity: 'semi' as const },
      })
      expect(pick([semi(rock), semi(gemstone), semi(frost)], [], ['semi'])).toBe(
        'Frost crabs with fire spells',
      )
    })
  })
})

describe('skillsWithMethod and skillsInPlay', () => {
  it('lists the skills that have a method of the intensity, in hiscores order', () => {
    expect(skillsWithMethod(accountWith(), ['afk'])).toEqual([
      'attack',
      'defence',
      'strength',
      'ranged',
      'magic',
      'cooking',
      'smithing',
    ])
    expect(skillsWithMethod(accountWith(), ['semi'])).toEqual(['agility'])
  })

  it('leaves out maxed and excluded skills', () => {
    const account = accountWith({ levels: { attack: 99 }, excluded: ['cooking', 'magic'] })
    expect(skillsWithMethod(account, ['afk'])).toEqual([
      'defence',
      'strength',
      'ranged',
      'smithing',
    ])
  })

  it('lists every skill with anything to grind for a balanced night', () => {
    expect(skillsInPlay(accountWith())).toEqual([
      'attack',
      'defence',
      'strength',
      'ranged',
      'magic',
      'cooking',
      'smithing',
      'mining',
      'agility',
      'slayer',
      'hunter',
      'construction',
    ])
  })
})

describe('skillWeight', () => {
  // a 90 Mining account is far from its next level, so the near-level bonus stays out of the way
  const miner = accountWith({ levels: { mining: 90 } })
  const motherlode = optionNamed(miner, 'mining', 'Motherlode Mine')
  const stars = optionNamed(miner, 'mining', 'Crashed stars')

  it('grows with the work left in the skill, flattened', () => {
    const expected = Math.pow(hoursLeft(miner, 'mining') + 1, 0.8)
    expect(skillWeight(miner, 'mining', motherlode, 40, [])).toBeCloseTo(expected, 10)
  })

  it('scales with how good the method is next to the skill’s best', () => {
    const best = skillWeight(miner, 'mining', motherlode, 40, [])
    expect(skillWeight(miner, 'mining', stars, 40, []) / best).toBeCloseTo(25_000 / 35_000, 10)
  })

  it('never lets a slow method count for less than a tenth', () => {
    const crawl: MethodOption = { ...stars, xpPerHour: 100 }
    const best = skillWeight(miner, 'mining', motherlode, 40, [])
    expect(skillWeight(miner, 'mining', crawl, 40, []) / best).toBeCloseTo(0.1, 10)
  })

  it('puts an unrated method in the middle', () => {
    const account = accountWith()
    const turael = optionNamed(account, 'slayer', 'Turael')
    // Slayer's hours come from its own fallback bands, not the flat rate
    const expected = Math.pow(hoursLeft(account, 'slayer') + 1, 0.8) * 0.5
    expect(skillWeight(account, 'slayer', turael, 40, [])).toBeCloseTo(expected, 8)
  })

  it('counts a skill dealt recently for less than half', () => {
    const fresh = skillWeight(miner, 'mining', motherlode, 40, [])
    const recent = skillWeight(miner, 'mining', motherlode, 40, ['cooking', 'mining'])
    expect(recent / fresh).toBeCloseTo(0.45, 10)
  })

  it('counts a skill for more when the block would reach its next level', () => {
    const outOfReach = skillWeight(miner, 'mining', motherlode, 40, [])
    const withinReach = skillWeight(miner, 'mining', motherlode, 6_000, [])
    expect(withinReach / outOfReach).toBeCloseTo(1.3, 10)
  })
})

describe('pickWeighted', () => {
  const items = ['a', 'b', 'c']

  it('draws exactly once', () => {
    const random = vi.fn(() => 0.5)
    pickWeighted(items, [1, 1, 1], random)
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('gives each item the share of the range its weight covers', () => {
    const weights = [1, 2, 1]
    expect(pickWeighted(items, weights, () => 0)).toBe('a')
    expect(pickWeighted(items, weights, () => 0.24)).toBe('a')
    expect(pickWeighted(items, weights, () => 0.26)).toBe('b')
    expect(pickWeighted(items, weights, () => 0.74)).toBe('b')
    expect(pickWeighted(items, weights, () => 0.76)).toBe('c')
  })

  it('never picks an item with no weight while another has some', () => {
    for (const roll of [0.01, 0.3, 0.6, 0.99]) {
      expect(pickWeighted(items, [0, 5, 0], () => roll)).toBe('b')
    }
  })

  it('picks evenly when no item has any weight', () => {
    expect(pickWeighted(items, [0, 0, 0], () => 0.1)).toBe('a')
    expect(pickWeighted(items, [0, 0, 0], () => 0.5)).toBe('b')
    expect(pickWeighted(items, [0, 0, 0], () => 0.9)).toBe('c')
  })

  it('has nothing to pick from an empty list', () => {
    expect(pickWeighted([], [], () => 0.5)).toBeUndefined()
  })
})

describe('dealSession: the mood', () => {
  it.each(SEEDS)('deals only AFK methods on an AFK night (seed %i)', (seed) => {
    const { session, moodRelaxed } = deal({ mood: 'afk', random: seededRandom(seed) })
    const blocks = skillBlocks(session)
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.every((block) => block.intensity === 'afk')).toBe(true)
    expect(blocks.every((block) => block.wanted.join() === 'afk')).toBe(true)
    expect(moodRelaxed).toBe(false)
  })

  it.each(SEEDS)('deals only active methods on a full-attention night (seed %i)', (seed) => {
    const { session } = deal({ mood: 'active', random: seededRandom(seed) })
    const blocks = skillBlocks(session)
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.every((block) => block.intensity === 'active')).toBe(true)
  })

  it.each(SEEDS)('alternates active and AFK slots on a balanced night (seed %i)', (seed) => {
    const { session } = deal({ mood: 'balanced', minutes: 160, random: seededRandom(seed) })
    const intensities = skillBlocks(session).map((block) => block.intensity)
    expect(intensities).toHaveLength(4)
    const [first, second] = intensities
    expect(new Set([first, second])).toEqual(new Set(['active', 'afk']))
    expect(intensities).toEqual([first, second, first, second])
  })

  it('leads a balanced night with either side, depending on the coin', () => {
    const leads = SEEDS.map(
      (seed) => skillBlocks(deal({ random: seededRandom(seed) }).session)[0]?.intensity,
    )
    expect(new Set(leads)).toEqual(new Set(['active', 'afk']))
  })

  it('deals fewer, longer blocks rather than break the mood', () => {
    // six slots, but only five AFK activities to go round: Nightmare Zone and the crab train
    // several skills each and may only be dealt once
    const { session, moodRelaxed } = deal({ mood: 'afk', minutes: 240 })
    const blocks = skillBlocks(session)
    expect(blocks).toHaveLength(5)
    expect(blocks.every((block) => block.intensity === 'afk')).toBe(true)
    expect(blocks.map((block) => block.minutes)).toEqual([48, 48, 48, 48, 48])
    expect(moodRelaxed).toBe(false)
  })

  it('mixes in other intensities only when nothing fits the mood at all, and says so', () => {
    const account = accountWith({ excluded: onlyInPlay('agility') })
    const { session, moodRelaxed } = deal({ account, mood: 'afk' })
    expect(moodRelaxed).toBe(true)
    expect(skillBlocks(session)).toMatchObject([
      { skill: 'agility', title: 'Rooftop courses', intensity: 'semi', wanted: ['semi'] },
    ])
  })

  it('falls back on semi-AFK within a balanced night without calling the mood relaxed', () => {
    const account = accountWith({ excluded: onlyInPlay('agility') })
    const { session, moodRelaxed } = deal({ account, mood: 'balanced' })
    expect(moodRelaxed).toBe(false)
    expect(skillBlocks(session).map((block) => block.skill)).toEqual(['agility'])
  })

  it('deals no skill blocks when nothing is in play', () => {
    const account = accountWith({ excluded: [...SKILL_KEYS] })
    expect(deal({ account }).session.blocks).toEqual([])
  })
})

describe('dealSession: one block per skill and per activity', () => {
  const moods: Mood[] = ['afk', 'active', 'balanced']

  it.each(SEEDS)('never repeats a skill or an activity (seed %i)', (seed) => {
    for (const mood of moods) {
      const blocks = skillBlocks(deal({ mood, minutes: 240, random: seededRandom(seed) }).session)
      const skills = blocks.map((block) => block.skill)
      const activities = blocks.map((block) => activityOf(block.title))
      expect(new Set(skills).size, `${mood}: ${skills.join()}`).toBe(skills.length)
      expect(new Set(activities).size, `${mood}: ${activities.join()}`).toBe(activities.length)
    }
  })

  it('deals Nightmare Zone for one stat at most, though it trains three', () => {
    for (const seed of SEEDS) {
      const blocks = skillBlocks(
        deal({ mood: 'afk', minutes: 240, random: seededRandom(seed) }).session,
      )
      expect(blocks.filter((block) => block.title === 'Nightmare Zone')).toHaveLength(1)
    }
  })
})

describe('dealSession: block lengths', () => {
  it.each([
    [30, 1],
    [60, 2],
    [90, 2],
    [120, 3],
    [180, 5],
    [240, 6],
    [600, 6],
  ])('gives a %i minute session %i skill blocks', (minutes, count) => {
    expect(skillBlocks(deal({ minutes }).session)).toHaveLength(count)
  })

  it('lets the last block take up the rounding', () => {
    // 100 minutes over three blocks is 33 each with one minute over
    const blocks = skillBlocks(deal({ minutes: 100 }).session)
    expect(blocks.map((block) => block.minutes)).toEqual([33, 33, 34])
  })

  it.each([60, 90, 100, 120, 180, 240])('fills exactly the %i minutes asked for', (minutes) => {
    for (const seed of SEEDS) {
      const { session } = deal({
        minutes,
        includeResets: true,
        includeWildcard: true,
        random: seededRandom(seed),
      })
      const total = session.blocks.reduce((sum, block) => sum + block.minutes, 0)
      expect(total).toBe(minutes)
    }
  })

  it('never deals a skill block shorter than 20 minutes, even if the session then overruns', () => {
    // 20 minutes less a five-minute reset leaves 15, but the block still gets 20
    const { session } = deal({ minutes: 20, includeResets: true })
    expect(session.blocks.map((block) => block.minutes)).toEqual([5, 20])
  })

  it('sets each block a target from its rate and length', () => {
    for (const block of skillBlocks(deal({ minutes: 100 }).session)) {
      expect(block.targetXp).toBe(Math.round((block.xpPerHour * block.minutes) / 60))
    }
  })
})

describe('dealSession: resets', () => {
  // an account far enough along to have more resets open than one session takes
  const account = accountWith({ everySkill: 80, allQuests: true, allDiaries: true })
  const due = dueResets(account, {}, NOW)

  it('starts from an account with more than two resets due', () => {
    expect(due.length).toBeGreaterThan(2)
  })

  it('puts the first two due resets at the front, five minutes each', () => {
    const { session } = deal({ account, includeResets: true })
    expect(session.blocks.slice(0, 2)).toMatchObject([
      { kind: 'reset', resetKey: due[0]?.key, title: due[0]?.name, minutes: 5 },
      { kind: 'reset', resetKey: due[1]?.key, title: due[1]?.name, minutes: 5 },
    ])
    expect(session.blocks.filter((block) => block.kind === 'reset')).toHaveLength(2)
  })

  it('takes their time out of the skill blocks', () => {
    const { session } = deal({ account, includeResets: true, minutes: 120 })
    const minutes = skillBlocks(session).reduce((sum, block) => sum + block.minutes, 0)
    expect(minutes).toBe(110)
  })

  it('leaves out a reset that has been done and is not due again', () => {
    const [first] = due
    const { session } = deal({
      account,
      includeResets: true,
      resetLog: first ? { [first.key]: NOW - 60_000 } : {},
    })
    const dealt = session.blocks.flatMap((block) => (block.kind === 'reset' ? block.resetKey : []))
    expect(dealt).toEqual([due[1]?.key, due[2]?.key])
  })

  it('deals none when the player has switched them off', () => {
    const { session } = deal({ account, includeResets: false })
    expect(session.blocks.some((block) => block.kind === 'reset')).toBe(false)
  })
})

describe('dealSession: the wildcard', () => {
  const wildcardOf = (session: Session) => session.blocks.find((block) => block.kind === 'wildcard')

  it('ends a session of 90 minutes or more, for 15 minutes', () => {
    const { session } = deal({ includeWildcard: true, minutes: 90 })
    expect(session.blocks.at(-1)).toMatchObject({ kind: 'wildcard', minutes: 15 })
  })

  it('is left out of a shorter session', () => {
    expect(wildcardOf(deal({ includeWildcard: true, minutes: 89 }).session)).toBeUndefined()
  })

  it('is left out of an AFK night: no wildcard is AFK', () => {
    const { session } = deal({ includeWildcard: true, minutes: 240, mood: 'afk' })
    expect(wildcardOf(session)).toBeUndefined()
  })

  it('is left out when the player has switched it off', () => {
    expect(wildcardOf(deal({ includeWildcard: false, minutes: 240 }).session)).toBeUndefined()
  })

  it('is only ever one the account meets the requirements for', () => {
    const open = WILDCARDS.filter(
      (wildcard) =>
        wildcard.requirements.quests.length === 0 && wildcard.requirements.skills.length === 0,
    ).map((wildcard) => wildcard.name)
    const dealt = new Set(
      SEEDS.map(
        (seed) =>
          wildcardOf(deal({ includeWildcard: true, random: seededRandom(seed) }).session)?.title,
      ),
    )
    expect(dealt.size).toBeGreaterThan(1)
    for (const title of dealt) expect(open).toContain(title)
  })
})

describe('dealSession: a quest step', () => {
  const step: QuestStepPick = {
    title: "Twilight's Promise",
    step: 'finish',
    minutes: 40,
    reason: { kind: 'saves', quest: 'Perilous Moons', hours: 33, opens: [], between: 0 },
  }
  const minutesOf = (session: Session) =>
    session.blocks.reduce((total, block) => total + block.minutes, 0)

  it('ends the session in the wildcard’s place, with its clock not started', () => {
    const { session } = deal({ includeWildcard: true, questStep: step })
    expect(session.blocks.at(-1)).toEqual({
      kind: 'quest',
      ...step,
      elapsed: 0,
      runningSince: null,
      done: false,
    })
    expect(session.blocks.filter((block) => block.kind === 'wildcard')).toEqual([])
  })

  it('leaves the skills a slot for every 40 minutes it does not take', () => {
    // two hours: two skill blocks beside a 40 minute step, where three would have it to themselves
    const { session } = deal({ minutes: 120, questStep: step })
    expect(skillBlocks(session)).toHaveLength(2)
    expect(minutesOf(session)).toBe(120)
    expect(skillBlocks(deal({ minutes: 120 }).session)).toHaveLength(3)
  })

  it('draws nothing for itself, where a wildcard would have drawn first', () => {
    const random = vi.fn(seededRandom(7))
    deal({ includeWildcard: true, minutes: 120, questStep: step, random })
    // the coin and one draw for each of the two skill blocks
    expect(random).toHaveBeenCalledTimes(1 + 2)
  })

  it('leaves the wildcard to end the session when there is no step', () => {
    const { session } = deal({ includeWildcard: true, minutes: 120, questStep: null })
    expect(session.blocks.at(-1)).toMatchObject({ kind: 'wildcard' })
  })
})

describe('dealSession: the random source', () => {
  it('deals the same session from the same seed', () => {
    const first = deal({ minutes: 240, includeWildcard: true, random: seededRandom(42) })
    const second = deal({ minutes: 240, includeWildcard: true, random: seededRandom(42) })
    expect(second).toEqual(first)
  })

  it('deals different sessions from different seeds', () => {
    const lineUps = SEEDS.map((seed) =>
      skillBlocks(deal({ random: seededRandom(seed) }).session)
        .map((block) => block.skill)
        .join(),
    )
    expect(new Set(lineUps).size).toBeGreaterThan(5)
  })

  it('draws once for the coin and once for each block, and not at all for a slot nothing fits', () => {
    const random = vi.fn(seededRandom(7))
    const { session } = deal({ mood: 'afk', minutes: 240, random })
    // five blocks from six slots: the sixth slot found nothing and must not have drawn
    expect(skillBlocks(session)).toHaveLength(5)
    expect(random).toHaveBeenCalledTimes(1 + 5)
  })

  it('draws for the wildcard before anything else', () => {
    const rolls = [0, 0.99, 0.5, 0.5, 0.5, 0.5]
    const random = vi.fn(() => rolls.shift() ?? 0.5)
    const { session } = deal({ includeWildcard: true, minutes: 90, random })
    // a first roll of 0 is the first wildcard in the list
    expect(session.blocks.at(-1)?.title).toBe(WILDCARDS[0]?.name)
    expect(random).toHaveBeenCalledTimes(1 + 1 + 2)
  })
})

describe('dealSession: recent skills', () => {
  const dealtSkills = (recentSkills: SkillKey[]) =>
    SEEDS.map(
      (seed) =>
        skillBlocks(
          deal({ mood: 'afk', minutes: 30, recentSkills, random: seededRandom(seed) }).session,
        )[0]?.skill,
    )

  it('deals a skill less often when it was dealt recently', () => {
    const count = (skills: (SkillKey | undefined)[]) =>
      skills.filter((skill) => skill === 'cooking').length
    expect(count(dealtSkills(['cooking']))).toBeLessThan(count(dealtSkills([])))
  })

  it('only holds the last three against a skill', () => {
    expect(dealtSkills(['cooking', 'hunter', 'hunter', 'hunter'])).toEqual(dealtSkills([]))
  })

  it('hands back the list with this session’s skills added, keeping the last six', () => {
    const before: SkillKey[] = ['fishing', 'hunter', 'thieving', 'prayer']
    const { session, recentSkills } = deal({ minutes: 120, recentSkills: before })
    const dealt = skillBlocks(session).map((block) => block.skill)
    expect(dealt).toHaveLength(3)
    expect(recentSkills).toEqual(['hunter', 'thieving', 'prayer', ...dealt])
  })
})

describe('dealSession: the session it starts', () => {
  it('starts now, unfinished, with every timer at zero', () => {
    const { session } = deal({ includeResets: true, includeWildcard: true })
    expect(session).toMatchObject({ startedAt: NOW, minutes: 120, endedAt: null, tally: null })
    for (const block of session.blocks) {
      expect(block).toMatchObject({ elapsed: 0, runningSince: null, done: false })
    }
  })

  it('remembers the XP every skill started with', () => {
    const account = accountWith({ levels: { mining: 50 } })
    const { session } = deal({ account })
    expect(session.startingXp.mining).toBe(account.skills.mining.xp)
    expect(Object.keys(session.startingXp)).toEqual([...SKILL_KEYS])
  })
})

describe('swapBlock', () => {
  const account = accountWith()
  const { session } = deal({ mood: 'afk', minutes: 80 })
  const [first, second] = skillBlocks(session)

  it('starts from a session with two AFK blocks', () => {
    expect(skillBlocks(session)).toHaveLength(2)
  })

  it.each(SEEDS)(
    'swaps in a different skill and activity of the same intensity (seed %i)',
    (seed) => {
      const swapped = swapBlock({ account, session, blockIndex: 0, random: seededRandom(seed) })
      const block = swapped?.blocks[0]
      if (block?.kind !== 'skill') throw new Error('The swap did not return a skill block')
      expect([first?.skill, second?.skill]).not.toContain(block.skill)
      expect([first, second].map((other) => activityOf(other?.title ?? ''))).not.toContain(
        activityOf(block.title),
      )
      expect(block.intensity).toBe('afk')
      expect(block.wanted).toEqual(['afk'])
    },
  )

  it('keeps the block’s length, resets its timer and sets a new target', () => {
    const underway: Session = {
      ...session,
      blocks: session.blocks.map((block, index) =>
        index === 0 ? { ...block, elapsed: 90_000, runningSince: NOW, done: true } : block,
      ),
    }
    const block = swapBlock({ account, session: underway, blockIndex: 0, random: seededRandom(3) })
      ?.blocks[0]
    if (block?.kind !== 'skill') throw new Error('The swap did not return a skill block')
    expect(block).toMatchObject({
      minutes: first?.minutes,
      elapsed: 0,
      runningSince: null,
      done: false,
    })
    expect(block.targetXp).toBe(Math.round((block.xpPerHour * block.minutes) / 60))
  })

  it('leaves the other blocks and the original session untouched', () => {
    const before = structuredClone(session)
    const swapped = swapBlock({ account, session, blockIndex: 0, random: seededRandom(3) })
    expect(swapped?.blocks[1]).toBe(session.blocks[1])
    expect(session).toEqual(before)
  })

  it('draws exactly once', () => {
    const random = vi.fn(seededRandom(3))
    swapBlock({ account, session, blockIndex: 0, random })
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('returns null when there is nothing else to swap in', () => {
    const narrow = accountWith({ excluded: onlyInPlay('cooking', 'smithing') })
    const dealt = deal({ account: narrow, mood: 'afk', minutes: 80 }).session
    expect(skillBlocks(dealt)).toHaveLength(2)
    const random = vi.fn(seededRandom(3))
    expect(swapBlock({ account: narrow, session: dealt, blockIndex: 0, random })).toBeNull()
    expect(random).not.toHaveBeenCalled()
  })

  it('returns null for a block that is not a skill block, or is not there', () => {
    const withExtras = deal({ includeResets: true, includeWildcard: true }).session
    const last = withExtras.blocks.length - 1
    const random = seededRandom(3)
    expect(swapBlock({ account, session: withExtras, blockIndex: 0, random })).toBeNull()
    expect(swapBlock({ account, session: withExtras, blockIndex: last, random })).toBeNull()
    expect(swapBlock({ account, session: withExtras, blockIndex: 99, random })).toBeNull()
  })
})

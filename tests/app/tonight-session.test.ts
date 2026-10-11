import { describe, expect, it } from 'vitest'
import type {
  ResetBlock,
  Session,
  SessionBlock,
  SkillBlock,
  WildcardBlock,
} from '#shared/types/session'
import { METHODS } from '#shared/data/methods'
import { forEverySkill } from '#shared/data/skills'
import { xpForLevel } from '#shared/domain/xp'
import {
  blockFact,
  blockSkill,
  blockTarget,
  blockTimeShare,
  capeGains,
  capesOfSession,
  clockCaption,
  elapsedOnScreen,
  formatSessionDay,
  levelProgress,
  overrunWarning,
  plannedMinutes,
  sessionSummary,
  slotCaption,
  slotPlan,
  tallyLines,
  tallySummary,
} from '~~/app/utils/tonight-session'
import { accountWith } from '../domain/helpers'

const MINUTE = 60_000
/** Eight in the evening on Saturday 10 October 2026, wherever the tests run. */
const SATURDAY_EVENING = new Date(2026, 9, 10, 20, 0).getTime()

const timer = { elapsed: 0, runningSince: null, done: false }

function skillBlock(overrides: Partial<SkillBlock> = {}): SkillBlock {
  return {
    kind: 'skill',
    skill: 'magic',
    title: 'Arceuus Library books',
    note: '',
    minutes: 33,
    intensity: 'active',
    wanted: ['active'],
    xpPerHour: 126_000,
    rateIsEstimate: false,
    targetXp: 69_300,
    ...timer,
    ...overrides,
  }
}

function resetBlock(overrides: Partial<ResetBlock> = {}): ResetBlock {
  return {
    kind: 'reset',
    resetKey: 'herb',
    title: 'Herb run',
    note: '',
    minutes: 5,
    skill: 'farming',
    ...timer,
    ...overrides,
  }
}

function wildcardBlock(overrides: Partial<WildcardBlock> = {}): WildcardBlock {
  return { kind: 'wildcard', title: 'Pest Control', note: '', minutes: 15, ...timer, ...overrides }
}

function sessionOf(blocks: SessionBlock[], overrides: Partial<Session> = {}): Session {
  return {
    startedAt: SATURDAY_EVENING,
    minutes: 90,
    blocks,
    startingXp: forEverySkill(() => 0),
    endedAt: null,
    tally: null,
    ...overrides,
  }
}

describe('blockSkill', () => {
  it('is the skill a skill block trains', () => {
    expect(blockSkill(skillBlock())).toBe('magic')
  })

  it('is the skill a reset feeds, when it feeds one', () => {
    expect(blockSkill(resetBlock())).toBe('farming')
    expect(blockSkill(resetBlock({ skill: null }))).toBeNull()
  })

  it('is nothing for a wildcard', () => {
    expect(blockSkill(wildcardBlock())).toBeNull()
  })
})

describe('capesOfSession', () => {
  it("lists the first three blocks' skills in running order, leaving out blocks with none", () => {
    const session = sessionOf([
      resetBlock({ skill: null }),
      resetBlock(),
      skillBlock(),
      wildcardBlock(),
      skillBlock({ skill: 'fishing' }),
      skillBlock({ skill: 'mining' }),
    ])
    expect(capesOfSession(session)).toEqual(['farming', 'magic', 'fishing'])
  })

  it('hangs a skill twice when two blocks feed it', () => {
    const session = sessionOf([resetBlock(), resetBlock({ resetKey: 'tree' })])
    expect(capesOfSession(session)).toEqual(['farming', 'farming'])
  })
})

describe('elapsedOnScreen', () => {
  it('is the banked time for a paused block, whatever the time is', () => {
    expect(elapsedOnScreen({ ...timer, elapsed: 5 * MINUTE }, SATURDAY_EVENING)).toBe(5 * MINUTE)
  })

  it('adds the stretch that is still running', () => {
    const running = { ...timer, elapsed: 5 * MINUTE, runningSince: SATURDAY_EVENING }
    expect(elapsedOnScreen(running, SATURDAY_EVENING + 2 * MINUTE)).toBe(7 * MINUTE)
  })

  it('never goes backwards when the screen is a moment behind the click that started it', () => {
    const running = { ...timer, elapsed: 5 * MINUTE, runningSince: SATURDAY_EVENING }
    expect(elapsedOnScreen(running, SATURDAY_EVENING - 900)).toBe(5 * MINUTE)
  })
})

describe('blockTimeShare', () => {
  it('is the share of the planned time used', () => {
    expect(blockTimeShare(skillBlock({ minutes: 30 }), 15 * MINUTE)).toBe(0.5)
    expect(blockTimeShare(skillBlock({ minutes: 30 }), 0)).toBe(0)
  })

  it('stops at the whole of it when a block runs over', () => {
    expect(blockTimeShare(skillBlock({ minutes: 30 }), 45 * MINUTE)).toBe(1)
  })
})

describe('blockFact', () => {
  const account = accountWith({ levels: { magic: 71, strength: 80, ranged: 59 } })

  it('gives a skill block its level, attention and rate', () => {
    expect(blockFact(skillBlock({ targetXp: 10 }), account)).toBe(
      'Magic 71, Active. ≈ 126k xp an hour.',
    )
  })

  it('says when the block should reach the next level', () => {
    const nearly: typeof account = {
      ...account,
      skills: { ...account.skills, magic: { level: 71, xp: xpForLevel(72) - 831 } },
    }
    expect(blockFact(skillBlock(), nearly)).toBe(
      'Magic 71, Active. ≈ 126k xp an hour. Level 72 this block.',
    )
    expect(blockFact(skillBlock({ targetXp: 830 }), nearly)).toBe(
      'Magic 71, Active. ≈ 126k xp an hour.',
    )
  })

  it('says which level an estimated rate was worked out from', () => {
    const estimate = { rateIsEstimate: true, xpPerHour: 48_400, targetXp: 10 }
    expect(blockFact(skillBlock({ ...estimate, skill: 'attack', intensity: 'afk' }), account)).toBe(
      'Attack 1, AFK. About 48k xp an hour, worked out from your Strength level.',
    )
    expect(blockFact(skillBlock({ ...estimate, skill: 'ranged' }), account)).toBe(
      'Ranged 59, Active. About 48k xp an hour, worked out from your Ranged level.',
    )
    expect(blockFact(skillBlock({ ...estimate, skill: 'magic' }), account)).toBe(
      'Magic 71, Active. About 48k xp an hour, worked out from your Magic level.',
    )
  })

  it('owns up to a method the wiki gives no rate for, and promises no level', () => {
    const unrated = skillBlock({ xpPerHour: 0, targetXp: 0, intensity: 'semi' })
    expect(blockFact(unrated, account)).toBe(
      'Magic 71, Semi-AFK. The wiki gives no hourly rate for this one.',
    )
  })

  it('tells an ironman when the method uses their own supplies, and nobody else', () => {
    const method = METHODS.construction.find((candidate) => candidate.usesOwnSupplies)
    if (!method) throw new Error('Construction has no method that uses supplies')
    const block = skillBlock({ skill: 'construction', title: method.name, targetXp: 10 })
    const ironman = accountWith({ type: 'iron', levels: { construction: 54 } })
    const main = accountWith({ type: 'main', levels: { construction: 54 } })
    expect(blockFact(block, ironman)).toBe(
      'Construction 54, Active. ≈ 126k xp an hour. Uses your own supplies.',
    )
    expect(blockFact(block, main)).toBe('Construction 54, Active. ≈ 126k xp an hour.')
    // a method that is no longer in the data says nothing
    expect(blockFact({ ...block, title: 'A method since renamed' }, ironman)).toBe(
      'Construction 54, Active. ≈ 126k xp an hour.',
    )
  })

  it('describes a reset and a wildcard by their length', () => {
    expect(blockFact(resetBlock(), account)).toBe('Timed run, about 5 minutes.')
    expect(blockFact(wildcardBlock(), account)).toBe(
      'Wildcard, 15 minutes. Whatever your account allows.',
    )
  })
})

describe('blockTarget', () => {
  it('is the XP a rated skill block should bring in', () => {
    expect(blockTarget(skillBlock())).toBe('+69k xp')
    expect(blockTarget(skillBlock({ rateIsEstimate: true, targetXp: 19_627 }))).toBe('est. +20k xp')
  })

  it('is nothing without a rate, or for a block that trains no method', () => {
    expect(blockTarget(skillBlock({ xpPerHour: 0, targetXp: 0 }))).toBeNull()
    expect(blockTarget(resetBlock())).toBeNull()
    expect(blockTarget(wildcardBlock())).toBeNull()
  })
})

describe('clockCaption', () => {
  it('gives only the length before the block has started', () => {
    expect(clockCaption(skillBlock(), 0)).toBe('of 33 min')
  })

  it('says whether the timer is running or paused', () => {
    expect(clockCaption(skillBlock({ runningSince: SATURDAY_EVENING }), 0)).toBe(
      'of 33 min, running',
    )
    expect(clockCaption(skillBlock({ elapsed: 842_000 }), 842_000)).toBe('of 33 min, paused')
  })
})

describe('levelProgress', () => {
  it('measures how far the skill is through its level', () => {
    const halfway = (xpForLevel(71) + xpForLevel(72)) / 2
    const progress = levelProgress({ level: 71, xp: halfway })
    expect(progress?.percent).toBeCloseTo(50)
    expect(progress?.xpToNextLevel).toBe(xpForLevel(72) - halfway)
    expect(progress?.nextLevel).toBe(72)
  })

  it('starts a level at nothing', () => {
    expect(levelProgress({ level: 1, xp: 0 })?.percent).toBe(0)
  })

  it('has no next level to show at 99', () => {
    expect(levelProgress({ level: 99, xp: 14_000_000 })).toBeNull()
  })
})

describe('a slot', () => {
  it('captions a skill block with its skill and attention', () => {
    expect(slotCaption(skillBlock())).toBe('Magic, Active')
    expect(slotCaption(skillBlock({ skill: 'fishing', intensity: 'afk' }))).toBe('Fishing, AFK')
  })

  it('captions a reset and a wildcard by what they are', () => {
    expect(slotCaption(resetBlock())).toBe('Timed run')
    expect(slotCaption(wildcardBlock())).toBe('Your pick')
  })

  it('plans a length and, for a skill block, a target', () => {
    expect(slotPlan(skillBlock())).toBe('33 min, +69k xp')
    expect(slotPlan(skillBlock({ rateIsEstimate: true }))).toBe('33 min, est. +69k xp')
    expect(slotPlan(skillBlock({ xpPerHour: 0, targetXp: 0 }))).toBe('33 min, no rate')
    expect(slotPlan(resetBlock())).toBe('5 min')
    expect(slotPlan(wildcardBlock())).toBe('15 min')
  })
})

describe('the session heading', () => {
  it('names the day a session was dealt', () => {
    expect(formatSessionDay(SATURDAY_EVENING)).toBe('Sat 10 Oct')
    expect(formatSessionDay(new Date(2027, 0, 3, 9, 30).getTime())).toBe('Sun 3 Jan')
  })

  it('sums the session up: the day, the length asked for and how much is done', () => {
    const session = sessionOf([
      resetBlock({ done: true }),
      resetBlock({ done: true }),
      skillBlock(),
      skillBlock({ skill: 'fishing' }),
      wildcardBlock(),
    ])
    expect(sessionSummary(session)).toBe('Sat 10 Oct, 90 min, 2 of 5 done')
  })
})

describe('planned time', () => {
  const blocks = [resetBlock(), skillBlock({ minutes: 20 }), skillBlock({ minutes: 20 })]

  it('adds up the blocks', () => {
    expect(plannedMinutes(sessionOf(blocks))).toBe(45)
  })

  it('warns when the blocks come to five minutes or more over what was asked for', () => {
    expect(overrunWarning(sessionOf(blocks, { minutes: 30 }))).toBe(
      '15 min over what you asked for',
    )
    expect(overrunWarning(sessionOf(blocks, { minutes: 40 }))).toBe('5 min over what you asked for')
  })

  it('lets a few minutes over, and any amount under, pass', () => {
    expect(overrunWarning(sessionOf(blocks, { minutes: 41 }))).toBeNull()
    expect(overrunWarning(sessionOf(blocks, { minutes: 45 }))).toBeNull()
    expect(overrunWarning(sessionOf(blocks, { minutes: 90 }))).toBeNull()
  })
})

describe('the tally', () => {
  const finished = sessionOf(
    [
      resetBlock({ elapsed: 300_000, done: true }),
      skillBlock({ elapsed: 842_000, done: true }),
      skillBlock({ skill: 'fishing', elapsed: 3_120_000, done: true }),
    ],
    {
      endedAt: SATURDAY_EVENING + 80 * MINUTE,
      tally: {
        gains: { hitpoints: 6_600, ranged: 20_000, magic: 36_214 },
        totalXp: 62_814,
        levels: { ranged: 1 },
      },
    },
  )

  it('lists the gains, the biggest first', () => {
    expect(tallyLines(finished)).toEqual([
      { skill: 'magic', xp: 36_214 },
      { skill: 'ranged', xp: 20_000 },
      { skill: 'hitpoints', xp: 6_600 },
    ])
  })

  it('keeps hiscores order between skills that gained the same', () => {
    const level = sessionOf([], {
      tally: { gains: { magic: 500, attack: 500, mining: 900 }, totalXp: 1_900, levels: {} },
    })
    expect(tallyLines(level).map((line) => line.skill)).toEqual(['mining', 'attack', 'magic'])
  })

  it('gives the time on the clock and the levels gained', () => {
    expect(tallySummary(finished)).toBe('71:02 on the clock, Ranged +1')
  })

  it('lists several level-ups in hiscores order', () => {
    const levels = { magic: 1, attack: 2 }
    const session = sessionOf(finished.blocks.slice(0, 1), {
      tally: { gains: { magic: 9_000, attack: 9_000 }, totalXp: 18_000, levels },
    })
    expect(tallySummary(session)).toBe('05:00 on the clock, Attack +2, Magic +1')
  })

  it('has no gains and no levels to list before the hiscores have moved', () => {
    const empty = sessionOf(finished.blocks, { tally: { gains: {}, totalXp: 0, levels: {} } })
    expect(tallyLines(empty)).toEqual([])
    expect(capeGains(empty)).toEqual([])
    expect(tallySummary(empty)).toBe('71:02 on the clock')
    // a session that has not been tallied at all reads the same
    expect(tallyLines(sessionOf(finished.blocks))).toEqual([])
    expect(capeGains(sessionOf(finished.blocks))).toEqual([])
  })

  it('gives each cape that gained the level it started the session at, in hiscores order', () => {
    const startingXp = forEverySkill((skill) => {
      // one XP short of 59, so the session's 20,000 took Ranged up a level
      if (skill === 'ranged') return xpForLevel(59) - 1
      if (skill === 'magic') return xpForLevel(70)
      return xpForLevel(skill === 'hitpoints' ? 67 : 50)
    })
    expect(capeGains({ ...finished, startingXp })).toEqual([
      { skill: 'hitpoints', xp: 6_600, levelBefore: 67 },
      { skill: 'ranged', xp: 20_000, levelBefore: 58 },
      { skill: 'magic', xp: 36_214, levelBefore: 70 },
    ])
  })

  it('leaves out a skill whose XP did not move', () => {
    const session = sessionOf([], {
      tally: { gains: { mining: 900, attack: 0 }, totalXp: 900, levels: {} },
    })
    expect(capeGains(session).map((gain) => gain.skill)).toEqual(['mining'])
  })
})

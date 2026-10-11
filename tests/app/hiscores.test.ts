import { describe, expect, it } from 'vitest'
import type { SavedHiscores } from '#shared/domain/save'
import { forEverySkill, SKILL_KEYS, skillName } from '#shared/data/skills'
import { describeStatsUpdate, parseHiscores, xpGainedSince, xpReading } from '~~/app/utils/hiscores'

const FETCHED_AT = 1_791_670_000_000

/** Jagex's JSON for an account with every skill at level 50, as /api/hiscores passes it on. */
function jagexPayload(changes: Record<string, { level: number; xp: number }> = {}) {
  const skills = SKILL_KEYS.map((skill, index) => ({
    id: index + 1,
    name: skillName(skill),
    rank: 1000,
    level: 50,
    xp: 101_333,
    ...changes[skillName(skill)],
  }))
  const overall = { id: 0, name: 'Overall', rank: 5000, level: 1200, xp: 2_431_992 }
  return {
    skills: [{ ...overall, ...changes.Overall }, ...skills],
    activities: [{ id: 0, name: 'Clue Scrolls (all)', rank: -1, score: -1 }],
    fetched: 1,
  }
}

function hiscoresWith(xp: Partial<Record<(typeof SKILL_KEYS)[number], number>>): SavedHiscores {
  return {
    fetchedAt: FETCHED_AT,
    skills: forEverySkill((skill) => ({ level: 50, xp: xp[skill] ?? 101_333 })),
    totalLevel: 1200,
    totalXp: 2_431_992,
  }
}

describe('parseHiscores', () => {
  it('reads every skill and the totals', () => {
    const hiscores = parseHiscores(jagexPayload({ Mining: { level: 63, xp: 372_706 } }), FETCHED_AT)
    expect(hiscores).toEqual({
      fetchedAt: FETCHED_AT,
      skills: forEverySkill((skill) =>
        skill === 'mining' ? { level: 63, xp: 372_706 } : { level: 50, xp: 101_333 },
      ),
      totalLevel: 1200,
      totalXp: 2_431_992,
    })
  })

  it('stamps the time it is given, not the one in the payload', () => {
    expect(parseHiscores(jagexPayload(), FETCHED_AT)?.fetchedAt).toBe(FETCHED_AT)
  })

  it('reads an unranked skill, which Jagex reports as -1, as level 1 with no XP', () => {
    const hiscores = parseHiscores(jagexPayload({ Sailing: { level: -1, xp: -1 } }), FETCHED_AT)
    expect(hiscores?.skills.sailing).toEqual({ level: 1, xp: 0 })
  })

  it('adds the totals up from the skills when the account has no overall rank', () => {
    const hiscores = parseHiscores(jagexPayload({ Overall: { level: -1, xp: -1 } }), FETCHED_AT)
    expect(hiscores?.totalLevel).toBe(SKILL_KEYS.length * 50)
    expect(hiscores?.totalXp).toBe(SKILL_KEYS.length * 101_333)
  })

  it('leaves out a skill this app does not know and fills in one the payload lacks', () => {
    const payload = jagexPayload()
    payload.skills = payload.skills.filter((row) => row.name !== 'Sailing')
    payload.skills.push({ id: 99, name: 'Dungeoneering', rank: 1, level: 120, xp: 104_273_167 })
    const hiscores = parseHiscores(payload, FETCHED_AT)
    expect(Object.keys(hiscores?.skills ?? {}).sort()).toEqual([...SKILL_KEYS].sort())
    expect(hiscores?.skills.sailing).toEqual({ level: 1, xp: 0 })
  })

  it.each([
    ['nothing', undefined],
    ['text', 'Service unavailable'],
    ['no skills list', { activities: [] }],
    ['a skills list with no skill in it', { skills: [{ name: 'Overall', level: 1, xp: 0 }] }],
    ['rows that are not rows', { skills: ['Attack', null, { name: 'Attack' }] }],
  ])('returns null for %s', (_what, payload) => {
    expect(parseHiscores(payload, FETCHED_AT)).toBeNull()
  })
})

describe('xpReading', () => {
  it("is every skill's XP and the total", () => {
    const reading = xpReading(hiscoresWith({ mining: 372_706 }))
    expect(reading.skills.mining).toBe(372_706)
    expect(reading.skills.attack).toBe(101_333)
    expect(Object.keys(reading.skills)).toHaveLength(SKILL_KEYS.length)
    expect(reading.totalXp).toBe(2_431_992)
  })
})

describe('xpGainedSince', () => {
  it('adds up the gains across skills', () => {
    const previous = hiscoresWith({})
    const fresh = hiscoresWith({ mining: 113_333, fishing: 101_833 })
    expect(xpGainedSince(previous, fresh)).toBe(12_500)
  })

  it('does not let a skill that went down cancel a gain', () => {
    // a rollback, or a name that changed hands: a loss is not a negative gain
    const previous = hiscoresWith({ mining: 500_000 })
    const fresh = hiscoresWith({ mining: 400_000, fishing: 102_333 })
    expect(xpGainedSince(previous, fresh)).toBe(1000)
  })

  it('is 0 when nothing has changed', () => {
    expect(xpGainedSince(hiscoresWith({}), hiscoresWith({}))).toBe(0)
  })
})

describe('describeStatsUpdate', () => {
  it('says how much was gained, in short form', () => {
    expect(describeStatsUpdate(12_400)).toBe('Stats updated. +12k XP since last time.')
    expect(describeStatsUpdate(1_250_000)).toBe('Stats updated. +1.25M XP since last time.')
  })

  it('says so when there is nothing new', () => {
    expect(describeStatsUpdate(0)).toBe('Stats updated. Nothing new since last time.')
  })
})

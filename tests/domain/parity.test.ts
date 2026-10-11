/*
 * Parity with the vanilla app this replaced. tests/fixtures holds one saved account and what
 * the old code computed for it under six combinations of account type, budget and tick-perfect
 * play. Everything here must come out the same, number for number and seed for seed.
 */
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Account, AccountType, Budget } from '#shared/types/account'
import type { Intensity } from '#shared/types/method'
import type { ResetCadence } from '#shared/types/reset'
import type { Mood, SessionBlock } from '#shared/types/session'
import type { SkillKey } from '#shared/types/skill'
import { RESETS } from '#shared/data/resets'
import { SKILL_KEYS } from '#shared/data/skills'
import { combatLevel } from '#shared/domain/account'
import { daysLeft, hoursLeft, isRoughEstimate, maxProgress } from '#shared/domain/estimates'
import {
  bestMethod,
  bestRateAt,
  fastestMethod,
  methodOptions,
  nextUnlock,
} from '#shared/domain/methods'
import { dailyGains, dayStreak, paceOver } from '#shared/domain/pace'
import { dealSession, methodForBlock, skillsWithMethod } from '#shared/domain/planner'
import { describeMissingRequirement, missingRequirements } from '#shared/domain/requirements'
import {
  describeResetStatus,
  resetAppliesTo,
  resetCadence,
  resetStatus,
} from '#shared/domain/resets'
import { accountFromSave, migrateLegacySave, migrateLegacySnapshots } from '#shared/domain/save'
import type { LegacySaveV1, LegacySnapshot } from '#shared/domain/save'
import { xpToMax } from '#shared/domain/xp'

interface AccountFixture {
  now: number
  state: LegacySaveV1
  snapshots: LegacySnapshot[]
}

interface ExpectedMethod {
  name: string
  level: number
  xph: number
  intensity: Intensity
  ok: boolean
  missing: string[]
  who: string
  run: boolean
  per: number
}

interface ExpectedSkill {
  level: number
  xp: number
  remaining: number
  hoursLeft: number
  daysLeft: number
  rough: boolean
  rateNow: number
  top: string | null
  next: string | null
  best: Record<Mood, string | null>
  pacePerDay: number
  methods: ExpectedMethod[]
}

interface ExpectedBlock {
  kind: 'skill' | 'reset' | 'wild'
  skill: SkillKey | null
  key: string | null
  title: string
  minutes: number
  intensity: string
  xph: number
  target: number
  want: Intensity[] | null
}

interface Expected {
  prefs: { account: AccountType; budget: Budget; ticks: boolean }
  combatLevel: number
  max: { pct: number; xp: number; levels: number; hours: number; maxed: number; n: number }
  skills: Record<SkillKey, ExpectedSkill>
  resets: {
    key: string
    every: number | 'utc' | 'weekly'
    locked: string[]
    due: { due: boolean; text: string }
  }[]
  pools: Record<Intensity, [SkillKey, string][]>
  pace7: { perDay: number; days: number }
  dailyGains: { key: string; gain: number; label: string }[]
  streak: number
  deals: { mood: Mood; minutes: number; seed: number; blocks: ExpectedBlock[] }[]
}

const EXPECTED_FILES = [
  'expected.main.json',
  'expected.main.cheap.json',
  'expected.main.ticks.json',
  'expected.main.cheap.ticks.json',
  'expected.iron.json',
  'expected.iron.ticks.json',
]

function readFixture<Shape>(file: string): Shape {
  return JSON.parse(readFileSync(new URL(`../fixtures/${file}`, import.meta.url), 'utf8')) as Shape
}

/** The generator the fixture's deals were made with, in place of Math.random. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

const fixture = readFixture<AccountFixture>('account.json')
const { now } = fixture
const save = migrateLegacySave(fixture.state)
const snapshots = migrateLegacySnapshots(fixture.snapshots)

function accountFor(prefs: Expected['prefs']): Account {
  const account = accountFromSave(save)
  return {
    ...account,
    type: prefs.account,
    preferences: { ...account.preferences, budget: prefs.budget, tickPerfect: prefs.ticks },
  }
}

const legacyCadence = (cadence: ResetCadence): number | 'utc' | 'weekly' => {
  if (cadence.kind === 'interval') return cadence.minutes
  return cadence.kind === 'weekly' ? 'weekly' : 'utc'
}

function legacyBlock(block: SessionBlock): ExpectedBlock {
  const none = { skill: null, key: null, xph: 0, target: 0, want: null }
  switch (block.kind) {
    case 'skill':
      return {
        kind: 'skill',
        skill: block.skill,
        key: null,
        title: block.title,
        minutes: block.minutes,
        intensity: block.intensity,
        xph: block.xpPerHour,
        target: block.targetXp,
        want: [...block.wanted],
      }
    case 'reset':
      return {
        ...none,
        kind: 'reset',
        key: block.resetKey,
        title: block.title,
        minutes: block.minutes,
        intensity: 'reset',
      }
    case 'wildcard':
      return {
        ...none,
        kind: 'wild',
        title: block.title,
        minutes: block.minutes,
        intensity: 'wild',
      }
  }
}

// calendar days are the player's own, and the fixture's player is in Britain
beforeAll(() => {
  process.env.TZ = 'Europe/London'
})

describe.each(EXPECTED_FILES)('parity with the vanilla app: %s', (file) => {
  const expected = readFixture<Expected>(file)
  const account = accountFor(expected.prefs)

  it('was computed at the same moment as the account fixture', () => {
    expect(readFixture<{ now: number }>(file).now).toBe(now)
  })

  it('gives the same combat level', () => {
    expect(combatLevel(account)).toBe(expected.combatLevel)
  })

  it('gives the same progress to max', () => {
    const progress = maxProgress(account)
    expect({
      pct: progress.percent,
      xp: progress.xp,
      levels: progress.levelsLeft,
      hours: progress.hoursLeft,
      maxed: progress.skillsMaxed,
      n: progress.skillCount,
    }).toEqual(expected.max)
  })

  describe.each(SKILL_KEYS)('%s', (skill) => {
    const want = expected.skills[skill]
    const stat = account.skills[skill]

    it('has the same level, XP and XP remaining', () => {
      expect(stat).toEqual({ level: want.level, xp: want.xp })
      expect(xpToMax(stat)).toBe(want.remaining)
    })

    it('has the same hours left, days left and roughness', () => {
      expect(hoursLeft(account, skill)).toBe(want.hoursLeft)
      expect(daysLeft(account, skill)).toBe(want.daysLeft)
      expect(isRoughEstimate(account, skill)).toBe(want.rough)
    })

    it('has the same best rate, fastest method, next unlock and best method per mood', () => {
      expect(bestRateAt(account, skill, stat.level)).toBe(want.rateNow)
      expect(fastestMethod(account, skill)?.method.name ?? null).toBe(want.top)
      expect(nextUnlock(account, skill)?.method.name ?? null).toBe(want.next)
      const moods: Mood[] = ['afk', 'active', 'balanced']
      for (const mood of moods) {
        expect(bestMethod(account, skill, mood)?.method.name ?? null, mood).toBe(want.best[mood])
      }
    })

    it('has the same pace', () => {
      expect(paceOver(snapshots, 7, now, skill).xpPerDay).toBe(want.pacePerDay)
    })

    it('lists the same methods in the same order', () => {
      const listed = methodOptions(account, skill).map((option) => ({
        name: option.method.name,
        level: option.method.level,
        xph: option.xpPerHour,
        intensity: option.method.intensity,
        ok: option.unlocked,
        missing: option.missing.map(describeMissingRequirement),
        who: option.method.audience,
        run: option.method.timedRun !== undefined,
        per: option.xpPerRun,
      }))
      expect(listed).toEqual(want.methods)
    })
  })

  it('gives the same resets, cadences, locks and due states', () => {
    const resets = RESETS.filter((reset) => resetAppliesTo(reset, account)).map((reset) => {
      const status = resetStatus(account, reset, save.resetLog[reset.key], now)
      return {
        key: reset.key,
        every: legacyCadence(resetCadence(account, reset)),
        locked: missingRequirements(account, reset.requirements).map(describeMissingRequirement),
        due: { due: status.due, text: describeResetStatus(status, now) },
      }
    })
    expect(resets).toEqual(expected.resets)
  })

  it.each(['afk', 'semi', 'active'] as const)('offers the same %s skills and methods', (wanted) => {
    const pool = skillsWithMethod(account, [wanted]).map((skill) => [
      skill,
      methodForBlock(account, skill, [wanted])?.method.name,
    ])
    expect(pool).toEqual(expected.pools[wanted])
  })

  it('gives the same pace, daily gains and streak', () => {
    const pace = paceOver(snapshots, 7, now)
    expect({ perDay: pace.xpPerDay, days: pace.days }).toEqual({
      perDay: expected.pace7.perDay,
      days: expected.pace7.days,
    })
    expect(
      dailyGains(snapshots, 14, now).map((gain) => ({
        key: gain.day,
        gain: gain.xp,
        label: gain.weekday,
      })),
    ).toEqual(expected.dailyGains)
    expect(dayStreak(save.history, snapshots, now)).toBe(expected.streak)
  })

  it('deals the same 72 sessions from the same seeds', () => {
    expect(expected.deals).toHaveLength(72)
    for (const deal of expected.deals) {
      const { session } = dealSession({
        account,
        minutes: deal.minutes,
        mood: deal.mood,
        includeResets: save.preferences.includeResets,
        includeWildcard: save.preferences.includeWildcard,
        recentSkills: [],
        resetLog: save.resetLog,
        now,
        random: seededRandom(deal.seed),
      })
      expect(
        session.blocks.map(legacyBlock),
        `${deal.mood}, ${deal.minutes} minutes, seed ${deal.seed}`,
      ).toEqual(deal.blocks)
    }
  })
})

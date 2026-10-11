import { describe, expect, it } from 'vitest'
import type { SkillKey } from '#shared/types/skill'
import { forEverySkill } from '#shared/data/skills'
import type { MaxProgress } from '#shared/domain/estimates'
import { unlockedResets } from '#shared/domain/resets'
import { MAX_XP } from '#shared/domain/xp'
import {
  capeDistance,
  closestCapes,
  daysToMaxLabel,
  dueCountLabel,
  resetWaitLabel,
  resetsDueFirst,
  xpBankedLabel,
  type CapeOutlook,
} from '~~/app/utils/tonight-side'
import { accountWith } from '../domain/helpers'

const MINUTE = 60_000
const NOW = 1_800_000_000_000

describe('resetsDueFirst', () => {
  const account = accountWith({ everySkill: 70, allQuests: true, allDiaries: true })
  const unlocked = unlockedResets(account)

  it('lists every reset the account has unlocked, and only those', () => {
    const rows = resetsDueFirst(account, {}, NOW)
    expect(rows.map((row) => row.reset.key)).toEqual(unlocked.map((reset) => reset.key))
    expect(resetsDueFirst(accountWith(), {}, NOW).length).toBeLessThan(rows.length)
  })

  it('calls a reset that has never been done due', () => {
    expect(resetsDueFirst(account, {}, NOW).every((row) => row.status.due)).toBe(true)
  })

  it('moves a reset done a moment ago below the ones still due, keeping the rest in order', () => {
    const [first, ...rest] = unlocked
    if (!first) throw new Error('The account in this test has no resets unlocked')
    const rows = resetsDueFirst(account, { [first.key]: NOW - MINUTE }, NOW)
    expect(rows.map((row) => row.reset.key)).toEqual([...rest, first].map((reset) => reset.key))
    expect(rows.at(-1)?.status.due).toBe(false)
  })
})

describe('dueCountLabel', () => {
  const account = accountWith({ everySkill: 70, allQuests: true, allDiaries: true })

  it('counts the resets that are due', () => {
    const rows = resetsDueFirst(account, {}, NOW)
    expect(dueCountLabel(rows)).toBe(`${rows.length} due`)
  })

  it('says so when none are', () => {
    const justDone = Object.fromEntries(
      unlockedResets(account).map((reset) => [reset.key, NOW - MINUTE]),
    )
    expect(dueCountLabel(resetsDueFirst(account, justDone, NOW))).toBe('none due')
    expect(dueCountLabel([])).toBe('none due')
  })
})

describe('resetWaitLabel', () => {
  it('rounds the wait up, so it never promises too soon', () => {
    expect(resetWaitLabel(33.2 * MINUTE)).toBe('in 34 min')
    expect(resetWaitLabel(5 * 60 * MINUTE)).toBe('in 5 h')
    expect(resetWaitLabel(3 * 24 * 60 * MINUTE)).toBe('in 3 days')
  })
})

/** An outlook for every skill: 100 hours from its cape at level 50 unless the sketch says otherwise. */
function outlooks(
  sketch: Partial<Record<SkillKey, Partial<Omit<CapeOutlook, 'skill'>>>>,
): Record<SkillKey, CapeOutlook> {
  return forEverySkill((skill) => ({
    skill,
    stat: { level: 50, xp: 101_333 },
    hoursLeft: 100,
    daysLeft: 0,
    isRough: false,
    ...sketch[skill],
  }))
}

describe('closestCapes', () => {
  it('lists the three skills with the fewest hours left, nearest first', () => {
    const closest = closestCapes(
      outlooks({
        prayer: { hoursLeft: 10 },
        construction: { hoursLeft: 14 },
        farming: { hoursLeft: 4 },
        mining: { hoursLeft: 60 },
      }),
    )
    expect(closest.map((outlook) => outlook.skill)).toEqual(['farming', 'prayer', 'construction'])
  })

  it('leaves out a skill that is already 99, and Hitpoints, which has no hours of its own', () => {
    const closest = closestCapes(
      outlooks({
        thieving: { stat: { level: 99, xp: MAX_XP }, hoursLeft: 0 },
        hitpoints: { hoursLeft: 0 },
        prayer: { hoursLeft: 10 },
      }),
    )
    expect(closest.map((outlook) => outlook.skill)).toEqual(['prayer', 'attack', 'defence'])
  })

  it('keeps hiscores order between skills as far off as each other', () => {
    expect(closestCapes(outlooks({})).map((outlook) => outlook.skill)).toEqual([
      'attack',
      'defence',
      'strength',
    ])
  })

  it('lists fewer than three when fewer are left, and none on a maxed account', () => {
    const maxed = { stat: { level: 99, xp: MAX_XP }, hoursLeft: 0 }
    const everySkillMaxed = forEverySkill(() => maxed)
    expect(closestCapes(outlooks(everySkillMaxed))).toEqual([])
    expect(
      closestCapes(outlooks({ ...everySkillMaxed, sailing: { hoursLeft: 300 } })).map(
        (outlook) => outlook.skill,
      ),
    ).toEqual(['sailing'])
  })
})

describe('capeDistance', () => {
  const outlook: CapeOutlook = {
    skill: 'prayer',
    stat: { level: 52, xp: 131_330 },
    hoursLeft: 10.4,
    daysLeft: 0,
    isRough: false,
  }

  it('counts hours, to the nearest whole one', () => {
    expect(capeDistance(outlook)).toEqual({ figure: '10', unit: 'hours' })
    expect(capeDistance({ ...outlook, hoursLeft: 1_204.6 })).toEqual({
      figure: '1,205',
      unit: 'hours',
    })
  })

  it('counts minutes inside the last hour', () => {
    expect(capeDistance({ ...outlook, hoursLeft: 0.75 })).toEqual({ figure: '45', unit: 'min' })
  })

  it('counts days of runs for a skill trained by them, whatever its hours say', () => {
    expect(capeDistance({ ...outlook, skill: 'farming', daysLeft: 49.6 })).toEqual({
      figure: '50',
      unit: 'days of runs',
    })
  })

  it('owns up to a rough estimate', () => {
    expect(capeDistance({ ...outlook, isRough: true }).unit).toBe('hours, rough')
    expect(capeDistance({ ...outlook, daysLeft: 3, isRough: true }).unit).toBe(
      'days of runs, rough',
    )
  })
})

describe('the distance to max', () => {
  const progress: MaxProgress = {
    percent: 12.26,
    xp: 38_350_000,
    levelsLeft: 742,
    hoursLeft: 1_956,
    skillsMaxed: 1,
    skillCount: 24,
  }

  it('sets the XP banked against the XP of every skill at 99', () => {
    expect(xpBankedLabel(progress)).toBe('38.35M of 312.83M')
  })

  it('divides the XP left by the pace', () => {
    const xpLeft = 24 * MAX_XP - progress.xp
    expect(daysToMaxLabel(progress, xpLeft / 3_674)).toBe('3,674 days')
  })

  it('has no pace to go on when nothing was gained', () => {
    expect(daysToMaxLabel(progress, 0)).toBe('no pace yet')
    expect(daysToMaxLabel(progress, -500)).toBe('no pace yet')
  })

  it('has nothing left to count on a maxed account', () => {
    expect(daysToMaxLabel({ ...progress, xp: 24 * MAX_XP }, 50_000)).toBe('no pace yet')
  })
})

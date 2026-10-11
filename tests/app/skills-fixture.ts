import { readFileSync } from 'node:fs'
import type { Account } from '#shared/types/account'
import type { SkillKey } from '#shared/types/skill'
import { daysLeft, hoursLeft, isRoughEstimate } from '#shared/domain/estimates'
import { fastestMethod, methodOptions, nextUnlock } from '#shared/domain/methods'
import { paceOver } from '#shared/domain/pace'
import {
  accountFromSave,
  migrateLegacySnapshots,
  readSave,
  type LegacySnapshot,
} from '#shared/domain/save'
import type { SkillInsight } from '~~/app/stores/account'

/** The saved account the parity tests use, which is also the account in the reference screenshots. */
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { now: number; state: unknown; snapshots: LegacySnapshot[] }

/** The fixture account as the rules see it: an ironman part of the way to max. */
export function fixtureAccount(): Account {
  const save = readSave(fixture.state)
  if (!save) throw new Error('tests/fixtures/account.json is not a save')
  return accountFromSave(save)
}

/** The fixture account's XP a day in a skill over the week before the fixture was taken. */
export function fixturePace(skill: SkillKey): number {
  return paceOver(migrateLegacySnapshots(fixture.snapshots), 7, fixture.now, skill).xpPerDay
}

/** What the account store works out about one skill, built the way the store builds it. */
export function insightFor(account: Account, skill: SkillKey): SkillInsight {
  const methods = methodOptions(account, skill)
  return {
    skill,
    stat: account.skills[skill],
    methods,
    hoursLeft: hoursLeft(account, skill),
    daysLeft: daysLeft(account, skill),
    isRough: isRoughEstimate(account, skill),
    fastestMethod: fastestMethod(account, skill, methods),
    nextUnlock: nextUnlock(account, skill, methods),
  }
}

/** An insight written out by hand: level 50 Mining with 100 hours left and no methods, unless told otherwise. */
export function insightWith(changes: Partial<SkillInsight> = {}): SkillInsight {
  return {
    skill: 'mining',
    stat: { level: 50, xp: 101_333 },
    methods: [],
    hoursLeft: 100,
    daysLeft: 0,
    isRough: false,
    fastestMethod: null,
    nextUnlock: null,
    ...changes,
  }
}

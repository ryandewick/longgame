import type { SkillKey } from '../types/skill'
import type { XpSnapshot } from '../types/snapshot'
import { isSkillKey } from '../data/skills'

/**
 * What the append rule needs to know about a snapshot. The browser keeps `XpSnapshot`s and the
 * local server keeps its own looser shape (any skill key), and both append by this one rule.
 */
export interface TimedXp {
  readonly takenAt: number
  readonly skills: Readonly<Record<string, number | undefined>>
}

export interface SnapshotAppend<Snapshot> {
  snapshots: Snapshot[]
  /** True when the reading held nothing new and the last snapshot was moved forward instead. */
  unchanged: boolean
}

function hasSameSkills(first: TimedXp['skills'], second: TimedXp['skills']): boolean {
  const skills = Object.keys(first)
  return (
    skills.length === Object.keys(second).length &&
    skills.every((skill) => first[skill] === second[skill])
  )
}

/**
 * Adds a snapshot to a player's history, keeping at most the newest `limit`.
 *
 * When the new snapshot shows the same XP as the last two, nothing is added: the last one's time
 * moves forward instead. That leaves exactly two snapshots around any quiet stretch. The first
 * stays where that XP first showed up, so the gain before it stays on the day it was earned, and
 * the second says the XP was still the same now. Without the rule, every refresh on a day off
 * would add a snapshot and push real history out of the limit.
 */
export function appendSnapshot<Snapshot extends TimedXp>(
  history: readonly Snapshot[],
  snapshot: Snapshot,
  limit: number,
): SnapshotAppend<Snapshot> {
  const last = history.at(-1)
  const beforeLast = history.at(-2)
  if (
    last &&
    beforeLast &&
    hasSameSkills(last.skills, snapshot.skills) &&
    hasSameSkills(beforeLast.skills, snapshot.skills)
  ) {
    return {
      snapshots: [...history.slice(0, -1), { ...last, takenAt: snapshot.takenAt }],
      unchanged: true,
    }
  }
  return { snapshots: [...history, snapshot].slice(-limit), unchanged: false }
}

/**
 * One history out of two of the same account's: every snapshot of either, oldest first, a moment
 * both hold kept once (the first history's), and the newest `limit` kept. A snapshot is a reading
 * of the account's XP at a moment, so the union of two histories is never wrong and nothing in
 * either is lost. This is how a history follows an account to a new name, and how an imported one
 * joins the one already kept.
 */
export function mergeSnapshots<Snapshot extends TimedXp>(
  first: readonly Snapshot[],
  second: readonly Snapshot[],
  limit: number,
): Snapshot[] {
  const byMoment = new Map<number, Snapshot>()
  for (const snapshot of [...first, ...second]) {
    if (!byMoment.has(snapshot.takenAt)) byMoment.set(snapshot.takenAt, snapshot)
  }
  return [...byMoment.values()].sort((one, other) => one.takenAt - other.takenAt).slice(-limit)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

function readSnapshot(value: unknown): XpSnapshot | null {
  if (!isRecord(value) || !isAmount(value.takenAt) || !isAmount(value.totalXp)) return null
  if (!isRecord(value.skills)) return null
  const skills: Partial<Record<SkillKey, number>> = {}
  for (const [skill, xp] of Object.entries(value.skills)) {
    if (isSkillKey(skill) && isAmount(xp)) skills[skill] = xp
  }
  return { takenAt: value.takenAt, skills, totalXp: value.totalXp }
}

/**
 * Reads a snapshot history that came from outside the app's own memory: the browser's storage,
 * or the local server. Anything that is not a snapshot is skipped rather than trusted, and so is
 * the XP of a skill this app does not know. The order is kept.
 */
export function parseSnapshots(stored: unknown): XpSnapshot[] {
  if (!Array.isArray(stored)) return []
  return stored.flatMap((entry: unknown) => readSnapshot(entry) ?? [])
}

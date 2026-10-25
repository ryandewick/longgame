import {
  appendSnapshot as appendByRule,
  mergeSnapshots as mergeByRule,
  type SnapshotAppend as SharedSnapshotAppend,
} from '#shared/domain/snapshots'
import { isJsonRecord, type JsonRecord } from './json'
import { parsePlayerName } from './player-name'
import { failure, success, type Result } from './result'

/** The most snapshots kept for one player. Older ones are dropped first. */
export const SNAPSHOT_LIMIT = 5000

/** More skills than the game has, with room to grow. A request with more than this is not from the app. */
const SKILLS_MAXIMUM = 64
const SKILL_KEY_PATTERN = /^[a-z]{1,20}$/
const UNREADABLE = 'Could not read that.'

/**
 * A player's XP at one moment. The fields match `XpSnapshot` in shared/types, so the app can use what this API
 * returns as it is. The server does not import that type because it checks the shape of a skill key, not whether the
 * game has such a skill: a new skill must not need a server change before its XP can be saved.
 */
export interface Snapshot {
  /** When it was taken, in milliseconds since 1970. Set by the server, never by the browser. */
  takenAt: number
  /** XP by skill key, for example `{ mining: 13034431 }`. */
  skills: Record<string, number>
  /** Total XP across all skills. */
  totalXp: number
}

/** What the browser sends after a hiscores refresh. */
export interface SnapshotReading {
  name: string
  skills: Record<string, number>
  totalXp: number
}

/** A history after `appendSnapshot`, and whether the reading held anything new. */
export type SnapshotAppend = SharedSnapshotAppend<Snapshot>

function isXpAmount(input: unknown): input is number {
  return typeof input === 'number' && Number.isFinite(input) && input >= 0
}

function isSkillsRecord(input: unknown): input is Record<string, number> {
  if (!isJsonRecord(input)) return false
  const entries = Object.entries(input)
  return (
    entries.length > 0 &&
    entries.length <= SKILLS_MAXIMUM &&
    entries.every(([skill, xp]) => SKILL_KEY_PATTERN.test(skill) && isXpAmount(xp))
  )
}

/** Checks the body of a request to record a snapshot. */
export function parseSnapshotReading(body: JsonRecord): Result<SnapshotReading> {
  const name = parsePlayerName(body.name)
  if (!name.ok) return name
  const { skills, totalXp } = body
  if (!isSkillsRecord(skills) || !isXpAmount(totalXp)) return failure(400, UNREADABLE)
  return success({ name: name.value, skills, totalXp })
}

/**
 * Adds a snapshot to a player's history, keeping the newest `limit`. The rule itself (a reading with nothing new
 * moves the last snapshot forward rather than adding one) is shared with the browser, which keeps the same kind of
 * history for the website: see shared/domain/snapshots.ts.
 */
export function appendSnapshot(
  history: readonly Snapshot[],
  snapshot: Snapshot,
  limit: number = SNAPSHOT_LIMIT,
): SnapshotAppend {
  return appendByRule(history, snapshot, limit)
}

/** What the browser sends to merge a history into a player's: when a name changes, or a file is imported. */
export interface SnapshotMerge {
  name: string
  snapshots: Snapshot[]
}

/**
 * Checks the body of a request to merge a history into a player's. As when a history is read from disk, an entry
 * that is not a snapshot is left out rather than trusted.
 */
export function parseSnapshotMerge(body: JsonRecord): Result<SnapshotMerge> {
  const name = parsePlayerName(body.name)
  if (!name.ok) return name
  if (!Array.isArray(body.snapshots)) return failure(400, UNREADABLE)
  return success({ name: name.value, snapshots: parseStoredSnapshots(body.snapshots) })
}

/**
 * Merges a history into a player's, keeping the newest `limit`: every snapshot of both, a moment both hold kept once
 * (the stored one). The rule is shared with the browser (shared/domain/snapshots.ts). A merge only adds, so no request
 * can take a player's history away; past the limit the oldest go first, as they do with every reading.
 */
export function mergeSnapshots(
  history: readonly Snapshot[],
  incoming: readonly Snapshot[],
  limit: number = SNAPSHOT_LIMIT,
): Snapshot[] {
  return mergeByRule(history, incoming, limit)
}

function isSnapshot(input: unknown): input is Snapshot {
  return (
    isJsonRecord(input) &&
    typeof input.takenAt === 'number' &&
    isSkillsRecord(input.skills) &&
    isXpAmount(input.totalXp)
  )
}

/**
 * Reads a history back from storage. The file is on the player's disk and may have been edited or cut short, so
 * anything that is not a snapshot is skipped rather than trusted.
 */
export function parseStoredSnapshots(stored: unknown): Snapshot[] {
  return Array.isArray(stored) ? stored.filter(isSnapshot) : []
}

/**
 * The storage key for a player's history. Lower case because names are not case sensitive (and neither is the
 * Windows file system), with underscores for spaces because the game treats the two as the same character.
 */
export function snapshotStorageKey(name: string): string {
  return `snapshots:${name.toLowerCase().replaceAll(' ', '_')}.json`
}

/*
 * The app this one replaced kept a history too, in its own shape: `{ t, skills, total }` in a file named
 * snapshots_<name>.json. A local copy reads those once, to carry an old history over (see local-saves.ts).
 */

/**
 * The old app's file name for a player's history, by the rule its server used: lower case, a space becomes an
 * underscore, and anything that is not a letter, a digit, an underscore or a hyphen is dropped.
 */
export function legacySnapshotStorageKey(name: string): string {
  const safeName = name
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_')
    .replace(/[^a-z0-9_-]/g, '')
  return `snapshots_${safeName || 'player'}.json`
}

function readLegacySnapshot(input: unknown): Snapshot | undefined {
  if (!isJsonRecord(input) || typeof input.t !== 'number' || !isSkillsRecord(input.skills)) {
    return undefined
  }
  // its earliest snapshots have no total; the app reads 0 as "not recorded"
  return {
    takenAt: input.t,
    skills: input.skills,
    totalXp: isXpAmount(input.total) ? input.total : 0,
  }
}

/**
 * Reads one of the old app's history files into this app's shape, in the same order. Like any file on the player's
 * disk it is not trusted: anything that is not one of its snapshots is skipped.
 */
export function parseLegacySnapshots(stored: unknown): Snapshot[] {
  return Array.isArray(stored) ? stored.flatMap((entry) => readLegacySnapshot(entry) ?? []) : []
}

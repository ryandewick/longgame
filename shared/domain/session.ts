import type {
  BlockTimer,
  HistoryBlock,
  HistoryEntry,
  Session,
  SessionBlock,
  SessionTally,
} from '../types/session'
import type { SkillKey, SkillStat } from '../types/skill'
import { SKILL_KEYS } from '../data/skills'
import { levelForXp } from './xp'

/** The history keeps this many sessions; older ones fall off the end. */
export const HISTORY_LIMIT = 400

/** How long has this block been timed for, counting the stretch that is still running? */
export function blockElapsed(block: BlockTimer, now: number): number {
  return block.elapsed + (block.runningSince === null ? 0 : now - block.runningSince)
}

function paused<Block extends SessionBlock>(block: Block, now: number): Block {
  if (block.runningSince === null) return block
  return { ...block, elapsed: blockElapsed(block, now), runningSince: null }
}

/**
 * Starts the block's timer, or pauses it if it is running. Only one block runs at a time, so
 * starting one pauses whichever was running.
 */
export function toggleBlock(session: Session, blockIndex: number, now: number): Session {
  const target = session.blocks[blockIndex]
  if (!target) return session
  const starting = target.runningSince === null
  const blocks = session.blocks.map((block, index) => {
    const stopped = paused(block, now)
    return index === blockIndex && starting ? { ...stopped, runningSince: now } : stopped
  })
  return { ...session, blocks }
}

/** Pauses every timer, which is how a session is closed before the tally. */
export function pauseAllBlocks(session: Session, now: number): Session {
  return { ...session, blocks: session.blocks.map((block) => paused(block, now)) }
}

/** A session with one block ticked off, and the reset that ticking it off completed, if any. */
export interface BlockCompletion {
  readonly session: Session
  /** Set when the block was a reset, for the caller to log as done now so it is not dealt again. */
  readonly completedResetKey: string | null
}

/** Marks a block done and stops its timer. */
export function completeBlock(session: Session, blockIndex: number, now: number): BlockCompletion {
  const target = session.blocks[blockIndex]
  const blocks = session.blocks.map((block, index) =>
    index === blockIndex ? { ...paused(block, now), done: true } : block,
  )
  return {
    session: { ...session, blocks },
    completedResetKey: target?.kind === 'reset' ? target.resetKey : null,
  }
}

/**
 * What did the session bring in? The XP each skill has now against what it had at the deal.
 * The deal remembers XP only, so the level a skill started at is worked out from its XP.
 */
export function tallyGains(
  startingXp: Readonly<Record<SkillKey, number>>,
  skillsNow: Readonly<Record<SkillKey, SkillStat>>,
): SessionTally {
  const gains: Partial<Record<SkillKey, number>> = {}
  const levels: Partial<Record<SkillKey, number>> = {}
  let totalXp = 0
  for (const skill of SKILL_KEYS) {
    const gained = skillsNow[skill].xp - startingXp[skill]
    if (gained <= 0) continue
    gains[skill] = gained
    totalXp += gained
    const levelsGained = skillsNow[skill].level - levelForXp(startingXp[skill])
    if (levelsGained > 0) levels[skill] = levelsGained
  }
  return { gains, totalXp, levels }
}

function historyBlock(block: SessionBlock): HistoryBlock {
  switch (block.kind) {
    case 'skill':
      return { kind: 'skill', skill: block.skill, title: block.title, done: block.done }
    case 'reset':
      return { kind: 'reset', resetKey: block.resetKey, title: block.title, done: block.done }
    case 'wildcard':
      return { kind: 'wildcard', title: block.title, done: block.done }
  }
}

/** A finished session, and the entry it leaves in the history. */
export interface FinishedSession {
  readonly session: Session
  readonly entry: HistoryEntry
}

/**
 * Closes the session: stops the timers and tallies the gains from freshly fetched stats.
 * Fetching them is the caller's job; the hiscores only update when the player logs out.
 */
export function finishSession(
  session: Session,
  skillsNow: Readonly<Record<SkillKey, SkillStat>>,
  now: number,
): FinishedSession {
  const stopped = pauseAllBlocks(session, now)
  const tally = tallyGains(session.startingXp, skillsNow)
  return {
    session: { ...stopped, endedAt: now, tally },
    entry: {
      ...tally,
      endedAt: now,
      minutes: session.minutes,
      elapsed: stopped.blocks.reduce((total, block) => total + block.elapsed, 0),
      blocks: stopped.blocks.map(historyBlock),
    },
  }
}

/** The history with a new entry at the front, trimmed to the newest `HISTORY_LIMIT`. */
export function addToHistory(
  history: readonly HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  return [entry, ...history].slice(0, HISTORY_LIMIT)
}

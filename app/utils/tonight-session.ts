import type { Account } from '#shared/types/account'
import type { BlockTimer, Session, SessionBlock, SkillBlock } from '#shared/types/session'
import type { SkillKey, SkillStat } from '#shared/types/skill'
import { METHODS } from '#shared/data/methods'
import { SKILL_KEYS, skillName } from '#shared/data/skills'
import { isIronman } from '#shared/domain/account'
import { formatClock, formatShortNumber, INTENSITY_LABELS } from '#shared/domain/format'
import { blockElapsed } from '#shared/domain/session'
import { levelForXp, MAX_LEVEL, xpForLevel, xpToNextLevel } from '#shared/domain/xp'

/*
 * What Tonight says about a session: its blocks, its clock and its tally. Everything here turns
 * what the planner dealt (shared/domain) into the words and figures on screen.
 */

const MINUTE = 60_000

/** A session planned this many minutes or more over what was asked for says so. */
const OVERRUN_WORTH_SAYING = 5

/** The skill a block trains: its own, or the one a reset feeds. A wildcard has none. */
export function blockSkill(block: SessionBlock): SkillKey | null {
  return block.kind === 'wildcard' ? null : block.skill
}

/**
 * The capes fanned on the finish panel: the skills the session's first blocks trained, in running
 * order. Two blocks may feed the same skill (a herb run and a tree run), which then hangs twice.
 */
export function capesOfSession(session: Session): SkillKey[] {
  return session.blocks.flatMap((block) => blockSkill(block) ?? []).slice(0, 3)
}

/**
 * Time on a block's clock as the screen shows it. The screen's idea of now only moves once a
 * second, so it can be a moment behind the click that started the timer: the running stretch is
 * never counted as negative.
 */
export function elapsedOnScreen(timer: BlockTimer, now: number): number {
  return blockElapsed(timer, Math.max(now, timer.runningSince ?? 0))
}

/** How much of a block's planned time has been used, from 0 to 1. */
export function blockTimeShare(block: SessionBlock, elapsed: number): number {
  return Math.min(1, Math.max(0, elapsed / (block.minutes * MINUTE)))
}

/** Does this method's rate come from one of the account's combat levels? The fact line names which. */
function estimatedFrom(skill: SkillKey): string {
  return skill === 'magic' || skill === 'ranged' ? skillName(skill) : 'Strength'
}

/** What a skill block's rate is, as a sentence. */
function rateSentence(block: SkillBlock): string {
  if (block.xpPerHour <= 0) return 'The wiki gives no hourly rate for this one.'
  const rate = formatShortNumber(block.xpPerHour)
  return block.rateIsEstimate
    ? `About ${rate} xp an hour, worked out from your ${estimatedFrom(block.skill)} level.`
    : `≈ ${rate} xp an hour.`
}

/** Does the block's method leave an ironman gathering its supplies first? */
function usesOwnSupplies(block: SkillBlock, account: Account): boolean {
  if (!isIronman(account)) return false
  // a block remembers its method by name; a method renamed since the deal simply says nothing
  const method = METHODS[block.skill].find((candidate) => candidate.name === block.title)
  return method?.usesOwnSupplies ?? false
}

/**
 * The one line of facts under the live block's title: 'Magic 71, Active. ≈ 126k xp an hour.
 * Level 72 this block.'
 */
export function blockFact(block: SessionBlock, account: Account): string {
  if (block.kind === 'reset') return `Timed run, about ${block.minutes} minutes.`
  if (block.kind === 'wildcard') {
    return `Wildcard, ${block.minutes} minutes. Whatever your account allows.`
  }
  const stat = account.skills[block.skill]
  const sentences = [
    `${skillName(block.skill)} ${stat.level}, ${INTENSITY_LABELS[block.intensity]}.`,
    rateSentence(block),
  ]
  if (usesOwnSupplies(block, account)) sentences.push('Uses your own supplies.')
  const levelWithinReach =
    stat.level < MAX_LEVEL && block.xpPerHour > 0 && xpToNextLevel(stat) <= block.targetXp
  if (levelWithinReach) sentences.push(`Level ${stat.level + 1} this block.`)
  return sentences.join(' ')
}

/** The XP a skill block should bring in: '+69k xp', 'est. +20k xp'. Null when the method has no rate. */
export function blockTarget(block: SessionBlock): string | null {
  if (block.kind !== 'skill' || block.xpPerHour <= 0) return null
  return `${block.rateIsEstimate ? 'est. ' : ''}+${formatShortNumber(block.targetXp)} xp`
}

/** The line under the clock: 'of 33 min, running'. A block not started yet has no state to give. */
export function clockCaption(block: SessionBlock, elapsed: number): string {
  const state = block.runningSince !== null ? ', running' : elapsed > 0 ? ', paused' : ''
  return `of ${block.minutes} min${state}`
}

/** How far a skill is through its current level, for the XP bar. */
export interface LevelProgress {
  /** The share of the level gained so far, 0 to 100. */
  readonly percent: number
  readonly xpToNextLevel: number
  readonly nextLevel: number
}

/** How far is the skill through its level? Null at 99: there is no next level to show. */
export function levelProgress(stat: SkillStat): LevelProgress | null {
  if (stat.level >= MAX_LEVEL) return null
  const levelStart = xpForLevel(stat.level)
  const levelEnd = xpForLevel(stat.level + 1)
  return {
    percent: Math.min(100, Math.max(0, ((stat.xp - levelStart) / (levelEnd - levelStart)) * 100)),
    xpToNextLevel: levelEnd - stat.xp,
    nextLevel: stat.level + 1,
  }
}

/** The quiet line under a slot's title: 'Magic, Active', 'Timed run', 'Your pick'. */
export function slotCaption(block: SessionBlock): string {
  if (block.kind === 'skill') {
    return `${skillName(block.skill)}, ${INTENSITY_LABELS[block.intensity]}`
  }
  return block.kind === 'reset' ? 'Timed run' : 'Your pick'
}

/** What a slot has planned: '33 min, +69k xp', '20 min, no rate', '5 min'. */
export function slotPlan(block: SessionBlock): string {
  const length = `${block.minutes} min`
  if (block.kind !== 'skill') return length
  return `${length}, ${blockTarget(block) ?? 'no rate'}`
}

/** The day a session was dealt, in the player's own time zone: 'Sat 10 Oct'. */
export function formatSessionDay(time: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(time)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  // put together by hand: the separators a locale adds between the parts have changed over the years
  return `${part('weekday')} ${part('day')} ${part('month')}`
}

/** The aside of the session heading: 'Sat 10 Oct, 90 min, 2 of 5 done'. */
export function sessionSummary(session: Session): string {
  const doneCount = session.blocks.filter((block) => block.done).length
  return `${formatSessionDay(session.startedAt)}, ${session.minutes} min, ${doneCount} of ${session.blocks.length} done`
}

/** The minutes the session's blocks add up to, which can be more than the player asked for. */
export function plannedMinutes(session: Session): number {
  return session.blocks.reduce((total, block) => total + block.minutes, 0)
}

/**
 * The warning under a session whose blocks add up to noticeably more than was asked for (short
 * sessions have a shortest block length to keep to). Null when it is close enough.
 */
export function overrunWarning(session: Session): string | null {
  const minutesOver = plannedMinutes(session) - session.minutes
  return minutesOver >= OVERRUN_WORTH_SAYING ? `${minutesOver} min over what you asked for` : null
}

/** One skill's line in the tally of a finished session. */
export interface TallyLine {
  readonly skill: SkillKey
  readonly xp: number
}

/** What a finished session gained in each skill, most first; ties in hiscores order. */
export function tallyLines(session: Session): TallyLine[] {
  const gains = session.tally?.gains ?? {}
  return SKILL_KEYS.flatMap((skill) => {
    const xp = gains[skill] ?? 0
    return xp > 0 ? [{ skill, xp }] : []
  }).sort((first, second) => second.xp - first.xp)
}

/** A cape's part in the tally: what its skill gained, and the level it was when the session was dealt. */
export interface CapeGain {
  readonly skill: SkillKey
  readonly xp: number
  readonly levelBefore: number
}

/**
 * The capes a finished session added to, in hiscores order, each with the level its starting XP
 * was worth: what the rack needs to show a cape filling from where it was to where it is.
 */
export function capeGains(session: Session): CapeGain[] {
  const gains = session.tally?.gains ?? {}
  return SKILL_KEYS.flatMap((skill) => {
    const xp = gains[skill] ?? 0
    return xp > 0 ? [{ skill, xp, levelBefore: levelForXp(session.startingXp[skill]) }] : []
  })
}

/** The aside of a finished session's tally: '71:02 on the clock, Ranged +1'. */
export function tallySummary(session: Session): string {
  const timed = session.blocks.reduce((total, block) => total + block.elapsed, 0)
  const levels = session.tally?.levels ?? {}
  const levelUps = SKILL_KEYS.flatMap((skill) => {
    const gained = levels[skill] ?? 0
    return gained > 0 ? [`${skillName(skill)} +${gained}`] : []
  })
  return [`${formatClock(timed)} on the clock`, ...levelUps].join(', ')
}

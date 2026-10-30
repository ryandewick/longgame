import type { Account } from '../types/account'
import type { Intensity } from '../types/method'
import type { Wildcard } from '../types/reset'
import type { Mood, Session, SessionBlock, SkillBlock } from '../types/session'
import type { SkillKey, SkillStat } from '../types/skill'
import { SKILL_KEYS, forEverySkill, skillDefinition } from '../data/skills'
import { WILDCARDS } from '../data/wildcards'
import { hoursLeft } from './estimates'
import {
  bestRateAt,
  grindableMethods,
  methodOptions,
  suitsTickPreference,
  supplyFactor,
  withinBudget,
} from './methods'
import type { MethodOption } from './methods'
import type { QuestStepPick } from './quest-step'
import { meetsRequirements } from './requirements'
import { dueResets } from './resets'
import type { ResetLog } from './resets'
import { MAX_LEVEL, xpToNextLevel } from './xp'

/** A session gets one skill block for about every 40 minutes, and never more than six. */
const MINUTES_PER_SLOT = 40
const MOST_SLOTS = 6
/** A skill block shorter than this is not worth the trip to the bank. */
const SHORTEST_SKILL_BLOCK = 20
const RESET_BLOCK_MINUTES = 5
/** Due resets beyond the first two wait for the next session, so they do not eat the evening. */
const MOST_RESETS_PER_SESSION = 2
const WILDCARD_BLOCK_MINUTES = 15
/** Sessions shorter than this have no room for a wildcard. */
export const SHORTEST_SESSION_WITH_WILDCARD = 90
/** A skill dealt in the last few blocks is less likely to be dealt again. */
const RECENT_BLOCKS_AVOIDED = 3
/** How many dealt skills are remembered from one session to the next. */
const RECENT_BLOCKS_REMEMBERED = 6

/**
 * Which intensities may this slot use, in order of preference? The mood decides. An AFK night
 * is AFK methods only and a full-attention night is active only. A balanced night alternates
 * active and AFK slots, and semi-AFK fills in on either side before the opposite does.
 */
export function slotPreferences(mood: Mood, slot: number, afkFirst: boolean): Intensity[][] {
  if (mood === 'afk') return [['afk']]
  if (mood === 'active') return [['active']]
  const activeSlot = (slot + (afkFirst ? 1 : 0)) % 2 === 0
  return activeSlot ? [['active'], ['semi'], ['afk']] : [['afk'], ['semi'], ['active']]
}

/**
 * What activity is this method, whatever style it is done in? 'Gemstone Crab with Dorgeshuun
 * crossbow' is still the crab. A session deals one block per activity.
 */
export function activityOf(methodName: string): string {
  return methodName.replace(/ with .*$/, '')
}

/**
 * Which methods of these intensities could the account grind in a block right now? Rated ones,
 * or the last one unlocked when the wiki rates none. Never a timed run or quest-skip advice.
 */
export function fittingMethods(
  account: Account,
  skill: SkillKey,
  intensities: readonly Intensity[],
  options: readonly MethodOption[] = methodOptions(account, skill),
): readonly MethodOption[] {
  if (skillDefinition(skill).passive) return []
  const open = options.filter(
    ({ method, unlocked }) =>
      unlocked &&
      !method.timedRun &&
      !method.questSkip &&
      suitsTickPreference(account, method) &&
      intensities.includes(method.intensity),
  )
  const rated = open.filter((option) => option.xpPerHour > 0)
  return withinBudget(account, rated.length ? rated : open.slice(-1))
}

/**
 * Which method would a block of these intensities get? The fastest that fits, with three
 * adjustments: supplies an ironman has to gather count against it, an AFK block passes over the
 * activities a method on offer is preferred to (`preferredOver`), and an AFK block weighs
 * effort as well as XP, so a method with per-trip setup (Nightmare Zone's dream fee, potions
 * and quest list) counts for three quarters of its rate. Activities already in the session are
 * passed over. Null when nothing fits.
 */
export function methodForBlock(
  account: Account,
  skill: SkillKey,
  intensities: readonly Intensity[],
  takenActivities: ReadonlySet<string> = new Set(),
  options: readonly MethodOption[] = methodOptions(account, skill),
): MethodOption | null {
  const afkBlock = intensities.includes('afk')
  const worth = ({ method, xpPerHour }: MethodOption) =>
    supplyFactor(account, method) * (afkBlock && method.perTripSetup ? 0.75 : 1) * xpPerHour
  const free = fittingMethods(account, skill, intensities, options).filter(
    (option) => !takenActivities.has(activityOf(option.method.name)),
  )
  // an AFK block passes over the activities a method on offer is preferred to (other crabs while
  // the Gemstone Crab is free), whatever their rates
  const passedOver = new Set(
    afkBlock ? free.flatMap((option) => option.method.preferredOver ?? []) : [],
  )
  const ranked = free
    .filter((option) => !passedOver.has(activityOf(option.method.name)))
    .sort((first, second) => worth(second) - worth(first))
  return ranked[0] ?? null
}

/** Is the skill still in play: under 99 and not excluded by the player? */
export function isInPlay(account: Account, skill: SkillKey): boolean {
  return account.skills[skill].level < MAX_LEVEL && !account.preferences.excludedSkills.has(skill)
}

/** Which skills could get a block of these intensities? What a strict mood has to choose from. */
export function skillsWithMethod(
  account: Account,
  intensities: readonly Intensity[],
  takenActivities?: ReadonlySet<string>,
): SkillKey[] {
  return SKILL_KEYS.filter(
    (skill) =>
      isInPlay(account, skill) &&
      methodForBlock(account, skill, intensities, takenActivities) !== null,
  )
}

/** Which skills have anything at all to grind? What a balanced mood has to choose from. */
export function skillsInPlay(account: Account): SkillKey[] {
  return SKILL_KEYS.filter(
    (skill) => isInPlay(account, skill) && grindableMethods(account, skill).length > 0,
  )
}

/** What the weighting needs to know about a skill beyond the method on offer. */
interface SkillOutlook {
  readonly stat: SkillStat
  readonly hoursLeft: number
  /** The best rate the account has in the skill at its current level, mood aside. */
  readonly bestXpPerHour: number
}

function skillOutlook(account: Account, skill: SkillKey): SkillOutlook {
  const stat = account.skills[skill]
  return {
    stat,
    hoursLeft: hoursLeft(account, skill),
    bestXpPerHour: bestRateAt(account, skill, stat.level),
  }
}

function weigh(
  outlook: SkillOutlook,
  xpPerHour: number,
  blockMinutes: number,
  dealtRecently: boolean,
): number {
  // an unrated method, or a skill with no rated method at all, sits in the middle
  const rateShare =
    xpPerHour > 0 && outlook.bestXpPerHour > 0
      ? Math.max(0.1, Math.min(1, xpPerHour / outlook.bestXpPerHour))
      : 0.5
  let weight = Math.pow(outlook.hoursLeft + 1, 0.8) * rateShare
  if (dealtRecently) weight *= 0.45
  // a level within reach of this block is worth chasing
  if (xpPerHour > 0 && xpToNextLevel(outlook.stat) < (xpPerHour * blockMinutes) / 60) weight *= 1.3
  return weight
}

/**
 * How much is this skill worth dealing with this method? The work left in the skill (flattened,
 * so the longest grind does not take every slot), scaled by how good the allowed method is next
 * to the skill's best. Skills dealt recently count for less; a level within the block's reach
 * counts for more.
 */
export function skillWeight(
  account: Account,
  skill: SkillKey,
  option: MethodOption,
  blockMinutes: number,
  recentSkills: readonly SkillKey[],
): number {
  return weigh(
    skillOutlook(account, skill),
    option.xpPerHour,
    blockMinutes,
    recentSkills.includes(skill),
  )
}

/**
 * Picks one item at random, each with a chance in proportion to its weight. Draws from `random`
 * exactly once. When no weight is positive, every item has the same chance.
 */
export function pickWeighted<Item>(
  items: readonly Item[],
  weights: readonly number[],
  random: () => number,
): Item | undefined {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return items[Math.floor(random() * items.length)]
  let remaining = random() * total
  for (const [index, item] of items.entries()) {
    remaining -= weights[index] ?? 0
    if (remaining <= 0) return item
  }
  return items.at(-1)
}

/** Remembers a per-skill answer for as long as one deal or swap lasts. */
function oncePerSkill<Value>(compute: (skill: SkillKey) => Value): (skill: SkillKey) => Value {
  const known = new Map<SkillKey, Value>()
  return (skill) => {
    let value = known.get(skill)
    if (value === undefined) {
      value = compute(skill)
      known.set(skill, value)
    }
    return value
  }
}

/** A skill chosen for a slot, with the method it will use and the intensities the slot wanted. */
interface SlotPick {
  readonly skill: SkillKey
  readonly option: MethodOption
  readonly wanted: readonly Intensity[]
}

/** Chooses skills for slots. One of these lives for a single deal or swap. */
interface SlotPicker {
  /** A skill and method for a slot of these intensities, or null when no skill has one. */
  pick(
    intensities: readonly Intensity[],
    takenSkills: ReadonlySet<SkillKey>,
    takenActivities: ReadonlySet<string>,
    blockMinutes: number,
    recentSkills: readonly SkillKey[],
  ): SlotPick | null
}

function createSlotPicker(account: Account, random: () => number): SlotPicker {
  // nothing about the account changes during a deal, so each skill is worked out once
  const optionsFor = oncePerSkill((skill) => methodOptions(account, skill))
  const outlookFor = oncePerSkill((skill) => skillOutlook(account, skill))

  return {
    pick(intensities, takenSkills, takenActivities, blockMinutes, recentSkills) {
      const candidates: SlotPick[] = []
      for (const skill of SKILL_KEYS) {
        if (!isInPlay(account, skill) || takenSkills.has(skill)) continue
        const option = methodForBlock(
          account,
          skill,
          intensities,
          takenActivities,
          optionsFor(skill),
        )
        if (option) candidates.push({ skill, option, wanted: intensities })
      }
      // checked before drawing: the random source must not be touched when nothing fits
      if (!candidates.length) return null
      const weights = candidates.map(({ skill, option }) =>
        weigh(outlookFor(skill), option.xpPerHour, blockMinutes, recentSkills.includes(skill)),
      )
      return pickWeighted(candidates, weights, random) ?? null
    },
  }
}

const freshTimer = { elapsed: 0, runningSince: null, done: false } as const

function skillBlock(pick: SlotPick, minutes: number): SkillBlock {
  const { method, xpPerHour } = pick.option
  return {
    kind: 'skill',
    skill: pick.skill,
    title: method.name,
    note: method.note,
    minutes,
    intensity: method.intensity,
    wanted: pick.wanted,
    xpPerHour,
    rateIsEstimate: method.computedRate !== undefined,
    targetXp: Math.round((xpPerHour * minutes) / 60),
    ...freshTimer,
  }
}

/** Everything a deal depends on. */
export interface DealRequest {
  readonly account: Account
  /** How long the player has tonight. */
  readonly minutes: number
  readonly mood: Mood
  /** Slot in resets that have come due. */
  readonly includeResets: boolean
  /** End a long session on a wildcard. */
  readonly includeWildcard: boolean
  /**
   * The quest or diary step to end on, which takes the wildcard's place: what quest-step.ts chose
   * for this account, length and mood. Null when the player has it off or nothing fits.
   */
  readonly questStep: QuestStepPick | null
  /** The skills dealt lately, oldest first: `Deal.recentSkills` from the deal before. */
  readonly recentSkills: readonly SkillKey[]
  readonly resetLog: ResetLog
  readonly now: number
  /** A source of numbers from 0 up to 1, such as Math.random. */
  readonly random: () => number
}

export interface Deal {
  readonly session: Session
  /** `recentSkills` with this session's skills added, to hand to the next deal. */
  readonly recentSkills: SkillKey[]
  /**
   * True when a strict mood found nothing at all and the session was dealt balanced instead.
   * The player should be told: it is not what they asked for.
   */
  readonly moodRelaxed: boolean
}

/**
 * Deals a session: due resets first, then a skill block for about every 40 minutes, then the
 * quest step the request carries, or else a wildcard if the session is long enough. Each slot's
 * skill is drawn at random, weighted by `skillWeight`, with one block per skill and one per
 * activity so Nightmare Zone is not dealt for three stats. When too few skills suit the mood the
 * session gets fewer, longer blocks rather than breaking the mood.
 */
export function dealSession(request: DealRequest): Deal {
  const { account, minutes, mood, random, now, questStep } = request
  // a quest step can take up to half the session, so the skills get a slot for every 40 minutes it leaves
  const slotMinutes = minutes - (questStep?.minutes ?? 0)
  const slotCount = Math.max(1, Math.min(MOST_SLOTS, Math.round(slotMinutes / MINUTES_PER_SLOT)))
  const blocks: SessionBlock[] = []
  let minutesLeft = minutes

  if (request.includeResets) {
    const due = dueResets(account, request.resetLog, now).slice(0, MOST_RESETS_PER_SESSION)
    for (const reset of due) {
      blocks.push({
        kind: 'reset',
        resetKey: reset.key,
        title: reset.name,
        note: reset.note,
        minutes: RESET_BLOCK_MINUTES,
        skill: reset.skill,
        ...freshTimer,
      })
      minutesLeft -= RESET_BLOCK_MINUTES
    }
  }

  // a quest step takes the wildcard's place; no wildcard is AFK, so an AFK night has none
  let wildcard: Wildcard | undefined
  if (questStep) {
    minutesLeft -= questStep.minutes
  } else if (
    request.includeWildcard &&
    minutes >= SHORTEST_SESSION_WITH_WILDCARD &&
    mood !== 'afk'
  ) {
    const open = WILDCARDS.filter((candidate) => meetsRequirements(account, candidate.requirements))
    wildcard = open[Math.floor(random() * open.length)]
    minutesLeft -= WILDCARD_BLOCK_MINUTES
  }

  const picker = createSlotPicker(account, random)
  const recentlyDealt = request.recentSkills.slice(-RECENT_BLOCKS_AVOIDED)
  const picks: SlotPick[] = []
  const takenSkills = new Set<SkillKey>()
  const takenActivities = new Set<string>()
  const fillSlots = (preferencesFor: (slot: number) => Intensity[][]) => {
    for (let slot = picks.length; slot < slotCount; slot++) {
      let pick: SlotPick | null = null
      for (const intensities of preferencesFor(slot)) {
        pick = picker.pick(
          intensities,
          takenSkills,
          takenActivities,
          minutesLeft / slotCount,
          recentlyDealt,
        )
        if (pick) break
      }
      if (!pick) break
      takenSkills.add(pick.skill)
      takenActivities.add(activityOf(pick.option.method.name))
      picks.push(pick)
    }
  }

  // which side a balanced night leads with is a coin toss; it is tossed whatever the mood
  const afkFirst = random() < 0.5
  fillSlots((slot) => slotPreferences(mood, slot, afkFirst))
  // only when nothing fits the mood at all does the session mix
  const moodRelaxed = picks.length === 0 && mood !== 'balanced'
  if (moodRelaxed) fillSlots((slot) => slotPreferences('balanced', slot, false))

  const evenShare = picks.length
    ? Math.max(SHORTEST_SKILL_BLOCK, Math.round(minutesLeft / picks.length))
    : 0
  picks.forEach((pick, index) => {
    // the last block takes up the rounding
    const isLast = index === picks.length - 1
    const blockMinutes = isLast
      ? Math.max(SHORTEST_SKILL_BLOCK, minutesLeft - evenShare * (picks.length - 1))
      : evenShare
    blocks.push(skillBlock(pick, blockMinutes))
  })

  if (questStep) {
    blocks.push({ kind: 'quest', ...questStep, ...freshTimer })
  } else if (wildcard) {
    blocks.push({
      kind: 'wildcard',
      title: wildcard.name,
      note: wildcard.description,
      minutes: WILDCARD_BLOCK_MINUTES,
      ...freshTimer,
    })
  }

  return {
    session: {
      startedAt: now,
      minutes,
      blocks,
      startingXp: forEverySkill((skill) => account.skills[skill].xp),
      endedAt: null,
      tally: null,
    },
    recentSkills: [...request.recentSkills, ...picks.map((pick) => pick.skill)].slice(
      -RECENT_BLOCKS_REMEMBERED,
    ),
    moodRelaxed,
  }
}

/** Everything a swap depends on. */
export interface SwapRequest {
  readonly account: Account
  readonly session: Session
  /** The block to replace, by its place in the session. */
  readonly blockIndex: number
  /** A source of numbers from 0 up to 1, such as Math.random. */
  readonly random: () => number
}

/**
 * Swaps a skill block for a different skill and activity of the intensities the slot was dealt
 * for, keeping its length and resetting its timer. Neither the block's own skill and activity
 * nor any other block's can come back. Returns null when there is nothing else to swap in, or
 * the block is not a skill block.
 */
export function swapBlock(request: SwapRequest): Session | null {
  const { account, session, blockIndex } = request
  const block = session.blocks[blockIndex]
  if (block?.kind !== 'skill') return null

  const skillBlocks = session.blocks.filter((other) => other.kind === 'skill')
  const takenSkills = new Set(skillBlocks.map((other) => other.skill))
  const takenActivities = new Set(skillBlocks.map((other) => activityOf(other.title)))
  // a swap is the player asking for something else, so recent sessions are not held against a skill
  const pick = createSlotPicker(account, request.random).pick(
    block.wanted,
    takenSkills,
    takenActivities,
    block.minutes,
    [],
  )
  if (!pick) return null

  const blocks = session.blocks.map((other, index) =>
    index === blockIndex ? skillBlock(pick, block.minutes) : other,
  )
  return { ...session, blocks }
}

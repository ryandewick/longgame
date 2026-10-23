import type { HistoryBlock, QuestBlock, QuestStepReason, SessionBlock } from '#shared/types/session'
import { DIARY_FACTS } from '#shared/data/diary-facts'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import type { ListIcon } from './assets'
import {
  goalStepWords,
  hoursInWords,
  listInWords,
  longTaskWords,
  tierRewardWords,
} from './quest-words'

/*
 * What Tonight says about a quest or diary step, the block dealt in the wildcard's place
 * (approval 5): what it is, why it was dealt, and the question its Done button asks.
 */

const MINUTE = 60_000

type SavesReason = Extract<QuestStepReason, { kind: 'saves' }>

/** The quest or diary icon a block wears, or null for a block that is neither. */
export function blockListIcon(block: SessionBlock | HistoryBlock): ListIcon | null {
  if (block.kind !== 'quest') return null
  return block.step === 'claim' ? 'diary' : 'quest'
}

/** What a step is: 'Quest', 'Miniquest' or 'Diary tier'. */
export function questStepKind(block: Pick<QuestBlock, 'title' | 'step'>): string {
  if (block.step === 'claim') return 'Diary tier'
  const kind = QUEST_FACTS.find((quest) => quest.name === block.title)?.kind
  return kind === 'miniquest' ? 'Miniquest' : 'Quest'
}

/** The quiet line under a step's slot title: 'Quest', 'Quest to start', 'Diary tier'. */
export function questStepCaption(block: QuestBlock): string {
  const kind = questStepKind(block)
  return block.step === 'start' ? `${kind} to start` : kind
}

/**
 * The line of facts under the step's title: 'Quest, about 40 minutes.' A quest needed only
 * started is costed at its whole time, so its line says at most.
 */
export function questStepFact(block: QuestBlock): string {
  return block.step === 'start'
    ? `${questStepCaption(block)}, at most ${block.minutes} minutes.`
    : `${questStepKind(block)}, about ${block.minutes} minutes.`
}

/** What the quest opens and the hours it saves: 'opens Red crabs, 2 hours off your time to max'. */
function opensAndHours(reason: SavesReason): string | null {
  if (!reason.opens.length) return null
  return `opens ${listInWords(reason.opens, 3)}, ${hoursInWords(reason.hours)} off your time to max`
}

/** Why a step that saves hours was dealt, as the mock-up says it for Twilight's Promise. */
function savesNote(block: QuestBlock, reason: SavesReason): string {
  const opens = opensAndHours(reason)
  const rewards = `its rewards take ${hoursInWords(reason.hours)} off your time to max`
  if (reason.quest === block.title) {
    const said = opens ?? rewards
    return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`
  }
  const when =
    reason.between === 0
      ? 'comes next'
      : `comes after ${reason.between === 1 ? 'one more quest' : `${reason.between} more quests`}`
  return `${reason.quest} ${when}: ${opens ? `it ${opens}` : rewards}.`
}

/**
 * Why the step was dealt, in a sentence or two: 'Perilous Moons comes next: it opens Sulphur
 * naguas and Calcified rocks, 33 hours off your time to max.', 'Fairy rings: start it to get
 * there.', or a tier's reward.
 */
export function questStepNote(block: QuestBlock): string {
  const { reason } = block
  switch (reason.kind) {
    case 'saves':
      return savesNote(block, reason)
    case 'unlock':
      return goalStepWords(
        reason.goal,
        reason.left,
        block.step === 'start' ? 'started' : 'finished',
      )
    case 'tier': {
      const diary = DIARY_FACTS.find((tier) => tier.name === block.title)
      return diary
        ? [tierRewardWords(diary, reason.opens), longTaskWords(diary)].filter(Boolean).join(' ')
        : ''
    }
  }
}

/** What the step's Done button asks before anything is ticked: did the player finish it? */
export interface QuestStepAsk {
  /** 'Quest, 41 minutes logged.' */
  readonly fact: string
  /** "Did you finish Twilight's Promise?" */
  readonly question: string
  /** What a yes does, then what a no leaves. */
  readonly note: string
  /** The button that says yes: 'Yes, tick it', or 'Yes, mark it started' for a quest to start. */
  readonly yes: string
}

/** The time on a step's clock, in words: '41 minutes logged'. */
function loggedWords(elapsed: number): string {
  const minutes = Math.floor(elapsed / MINUTE)
  if (minutes >= 1) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} logged`
  return elapsed > 0 ? 'under a minute logged' : 'no time logged'
}

/** What a yes moves on, in a sentence; empty when it moves nothing worth saying. */
function yesWords(block: QuestBlock, ticking: string): string {
  const { reason } = block
  switch (reason.kind) {
    case 'saves': {
      if (reason.quest === block.title) {
        return reason.opens.length
          ? `${ticking} opens ${listInWords(reason.opens, 3)} in your plan.`
          : ''
      }
      const away =
        reason.between === 0
          ? 'ready to do'
          : `${reason.between === 1 ? 'one quest' : `${reason.between} quests`} away`
      return `${ticking} leaves ${reason.quest}, and its ${hoursInWords(reason.hours)} off, ${away}.`
    }
    case 'unlock': {
      const after = reason.left - 1
      return after === 0
        ? `It is the last quest ${reason.goal} needs.`
        : `${ticking} leaves ${reason.goal} ${after === 1 ? 'one quest' : `${after} quests`} away.`
    }
    case 'tier':
      return reason.opens.length
        ? `${ticking} opens ${listInWords(reason.opens, 3)} in your plan.`
        : ''
  }
}

/**
 * The question in the step's panel once Done is pressed, its clock stopped at `elapsed`
 * milliseconds. A yes ticks the quest or tier (or marks a quest started); a no leaves it in Next.
 */
export function questStepAsk(block: QuestBlock, elapsed: number): QuestStepAsk {
  const ticking = block.step === 'start' ? 'Marking it started' : 'Ticking it'
  const question =
    block.step === 'claim'
      ? `Did you claim the ${block.title} reward?`
      : `Did you ${block.step === 'start' ? 'start' : 'finish'} ${block.title}?`
  const notYet =
    block.step === 'claim'
      ? 'Not claimed?'
      : block.step === 'start'
        ? 'Not started?'
        : 'Not finished?'
  return {
    fact: `${questStepKind(block)}, ${loggedWords(elapsed)}.`,
    question,
    note: [yesWords(block, ticking), `${notYet} It stays in Next for another night.`]
      .filter(Boolean)
      .join(' '),
    yes: block.step === 'start' ? 'Yes, mark it started' : 'Yes, tick it',
  }
}

import type { Account } from '../types/account'
import type { Mood, QuestBlock, QuestStepReason } from '../types/session'
import { QUEST_FACTS } from '../data/quest-facts'
import { SMALLEST_SAVING_IN_HOURS } from './plan-questions'
import { questMinutes, type QuestStep } from './quest-cost'
import { suggestions as suggestionsFor, type Suggestions } from './suggestions'

/*
 * The quest or diary step a session ends on, in the wildcard's place (approval 5): the first
 * thing the Quests page's Next suggests that fits in half the session. Never on an AFK night,
 * since no quest is AFK, and only in a session of an hour or more, so the skills keep a full
 * block beside it. The planner lays it out (planner.ts); this chooses it.
 */

/** A quest step takes at most this share of the session. */
const QUEST_STEP_SHARE = 0.5
/** Sessions shorter than this have no room for a quest step beside a skill block. */
export const SHORTEST_SESSION_WITH_QUEST_STEP = 60
/** A step's length is rounded to five minutes: the estimates are no finer than that. */
const MINUTES_ROUNDED_TO = 5

/** A step chosen for tonight: the block the planner deals, without its timer. */
export type QuestStepPick = Pick<QuestBlock, 'title' | 'step' | 'minutes' | 'reason'>

const FACTS = new Map(QUEST_FACTS.map((quest) => [quest.name, quest]))

function rounded(minutes: number): number {
  return Math.max(MINUTES_ROUNDED_TO, Math.round(minutes / MINUTES_ROUNDED_TO) * MINUTES_ROUNDED_TO)
}

/** A quest as a step for tonight, or null for an entry the data does not time. */
function questPick(
  account: Account,
  step: QuestStep,
  reason: QuestStepReason,
): QuestStepPick | null {
  const facts = FACTS.get(step.quest)
  const minutes = facts ? questMinutes(account, facts) : 0
  if (!minutes) return null
  return {
    title: step.quest,
    step: step.state === 'started' ? 'start' : 'finish',
    minutes: rounded(minutes),
    reason,
  }
}

/**
 * Every step Next suggests, in the order tonight tries them. What saves hours comes first, the
 * most hours for its whole time first: each quest by the first of the steps it takes (the quest
 * itself when nothing has to come before it), and the diary tiers whose reward opens a method or
 * a reset. Then the next quest towards each goal in the account's guide (decision 7), where the
 * account is ready for it. Then the other diary tiers, in decision 6's order.
 */
export function questStepsInOrder(
  account: Account,
  all: Suggestions = suggestionsFor(account),
): QuestStepPick[] {
  const saving: { readonly pick: QuestStepPick; readonly perHour: number }[] = []
  for (const suggestion of all.savingHours) {
    const [step = { quest: suggestion.quest.name, state: 'finished' as const }] = suggestion.first
    const pick = questPick(account, step, {
      kind: 'saves',
      quest: suggestion.quest.name,
      hours: suggestion.hoursSaved,
      opens: suggestion.effect.opens,
      between: Math.max(0, suggestion.first.length - 1),
    })
    if (pick) saving.push({ pick, perHour: suggestion.hoursSaved / (suggestion.minutes / 60) })
  }

  const otherTiers: QuestStepPick[] = []
  for (const tier of all.tiers) {
    if (!tier.minutes) continue
    const pick: QuestStepPick = {
      title: tier.diary.name,
      step: 'claim',
      minutes: rounded(tier.minutes),
      reason: { kind: 'tier', opens: tier.opens },
    }
    if (tier.unlockHours >= SMALLEST_SAVING_IN_HOURS) {
      saving.push({ pick, perHour: tier.unlockHours / (tier.minutes / 60) })
    } else {
      otherTiers.push(pick)
    }
  }

  const unlocks = all.unlocks.flatMap(({ goal, next, readiness, standing }) => {
    if (readiness.missing.length) return []
    const pick = questPick(account, next, {
      kind: 'unlock',
      goal: goal.name,
      left: standing.steps.length,
    })
    return pick ? [pick] : []
  })

  // a stable sort: quests that save as much for their time keep Next's own order
  const byHours = [...saving].sort((first, second) => second.perHour - first.perHour)
  return [...byHours.map(({ pick }) => pick), ...unlocks, ...otherTiers]
}

/**
 * The step tonight's session ends on: the first of `questStepsInOrder` that fits in half the
 * session. Null on an AFK night, in a session under an hour, or when nothing fits.
 * `all` is the account's suggestions when they are worked out already.
 */
export function questStepFor(
  account: Account,
  minutes: number,
  mood: Mood,
  all?: Suggestions,
): QuestStepPick | null {
  if (mood === 'afk' || minutes < SHORTEST_SESSION_WITH_QUEST_STEP) return null
  const room = minutes * QUEST_STEP_SHARE
  return questStepsInOrder(account, all).find((pick) => pick.minutes <= room) ?? null
}

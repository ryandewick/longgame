import type { Account } from '../types/account'
import type { QuestFacts, QuestState } from '../types/quest'
import { QUEST_FACTS } from '../data/quest-facts'
import { hasCompletedQuest, hasStartedQuest, isIronman } from './account'
import { questPrerequisites } from './quest-chains'
import { questReadiness, type BoostedLevel, type Readiness } from './readiness'

/*
 * What doing a quest, or a goal's whole tree, takes: the quests still to do in an order that
 * works, whether the account is ready for each when it gets there, and the minutes at an
 * ordinary pace (decision 9). A quest needed only started is costed at its whole time, since the
 * data does not say how far a start goes: an upper bound, never an underestimate.
 */

/** One thing to do: finish a quest, or only start it. */
export interface QuestStep {
  readonly quest: string
  readonly state: QuestState
}

const FACTS: ReadonlyMap<string, QuestFacts> = new Map(
  QUEST_FACTS.map((quest) => [quest.name, quest]),
)

/**
 * The minutes a quest takes the account at an ordinary pace: its mid minutes (2 times speedrun
 * pace) and its waits, and for an ironman the minutes it spends gathering what a main would buy
 * and its own waits. 0 for an entry the data does not time.
 */
export function questMinutes(account: Account, quest: QuestFacts): number {
  const { minutes, ironmanMinutes, waitMinutes, ironmanWaitMinutes } = quest.time
  if (!minutes) return 0
  const ironman = isIronman(account) ? ironmanMinutes + ironmanWaitMinutes : 0
  return minutes.mid + waitMinutes + ironman
}

/** Is the quest already as far as this state? A finished quest counts as started. */
function isAt(account: Account, quest: string, state: QuestState): boolean {
  return state === 'finished' ? hasCompletedQuest(account, quest) : hasStartedQuest(account, quest)
}

/**
 * The steps to get every wanted quest as far as wanted, in an order that puts each after what it
 * needs: a quest to finish after the quests it requires and the ones it needs started, a quest to
 * start after the quests it requires (the safe reading of acceptance B5). Quests already that far
 * are left out, and a quest wanted both started and finished is finished once.
 */
export function stepsToDo(
  account: Account,
  wanted: Readonly<Record<string, QuestState>>,
): QuestStep[] {
  const needed = new Map<string, QuestState>()
  const need = (quest: string, state: QuestState): void => {
    const known = needed.get(quest)
    if (known === 'finished' || known === state || isAt(account, quest, state)) return
    needed.set(quest, state)
    const facts = FACTS.get(quest)
    if (!facts) return
    for (const required of facts.requires) need(required, 'finished')
    if (state === 'finished') for (const started of facts.requiresStarted) need(started, 'started')
  }
  for (const [quest, state] of Object.entries(wanted)) need(quest, state)

  const ordered: QuestStep[] = []
  const placed = new Set<string>()
  const place = (quest: string): void => {
    if (placed.has(quest)) return
    placed.add(quest)
    const state = needed.get(quest) ?? 'finished'
    const facts = FACTS.get(quest)
    const before = facts
      ? [...facts.requires, ...(state === 'finished' ? facts.requiresStarted : [])]
      : []
    for (const other of before) if (needed.has(other)) place(other)
    ordered.push({ quest, state })
  }
  for (const quest of [...needed.keys()].sort()) place(quest)
  return ordered
}

/** The account once a step is done. */
function withStep(account: Account, { quest, state }: QuestStep): Account {
  return state === 'finished'
    ? { ...account, completedQuests: new Set([...account.completedQuests, quest]) }
    : { ...account, startedQuests: new Set([...account.startedQuests, quest]) }
}

/** Whether a run of steps can be done now, in order, and the boosts it counts on. */
export interface StepsCheck {
  /** The first step the account is not ready for when it gets there, and what that needs; null when every one is ready. */
  readonly blocked: { readonly step: QuestStep; readonly readiness: Readiness } | null
  /** The levels met only with a boost along the way. */
  readonly boosted: readonly BoostedLevel[]
}

/**
 * Checks each step's readiness as the account would be when it gets there: every step before it
 * done, so their quest points and Kudos count, and its levels as they are now.
 */
export function checkSteps(account: Account, steps: readonly QuestStep[]): StepsCheck {
  let working = account
  const boosted: BoostedLevel[] = []
  for (const step of steps) {
    const facts = FACTS.get(step.quest)
    if (facts) {
      const readiness = questReadiness(working, facts, step.state === 'started')
      if (readiness.missing.length) return { blocked: { step, readiness }, boosted }
      boosted.push(...readiness.boosted)
    }
    working = withStep(working, step)
  }
  return { blocked: null, boosted }
}

/** The minutes a run of steps takes the account. */
export function stepsMinutes(account: Account, steps: readonly QuestStep[]): number {
  return steps.reduce((sum, { quest }) => {
    const facts = FACTS.get(quest)
    return facts ? sum + questMinutes(account, facts) : sum
  }, 0)
}

/** Quests that make up a shortfall of quest points, and the minutes they take. */
export interface QuestPointsFill {
  readonly quests: readonly string[]
  readonly minutes: number
}

/**
 * The quickest quests to make up a shortfall of quest points, as the research estimated it: again
 * and again the quest (with whatever of its chain is not done) that gives the most quest points
 * a minute, until the shortfall is made up. `have` is what is done or planned already. Levels are
 * not looked at: this is an estimate of time, not a plan.
 */
export function questPointsFill(
  account: Account,
  have: ReadonlySet<string>,
  short: number,
): QuestPointsFill {
  const taken = new Set(have)
  const quests: string[] = []
  let minutes = 0
  let left = short
  while (left > 0) {
    let best: { quest: string; chain: string[]; points: number; minutes: number } | null = null
    for (const facts of QUEST_FACTS) {
      if (
        !facts.gives.questPoints ||
        taken.has(facts.name) ||
        hasCompletedQuest(account, facts.name)
      )
        continue
      const chain = [facts.name, ...questPrerequisites(facts.name)].filter(
        (quest) => !taken.has(quest) && !hasCompletedQuest(account, quest),
      )
      let points = 0
      let chainMinutes = 0
      for (const quest of chain) {
        const linked = FACTS.get(quest)
        points += linked?.gives.questPoints ?? 0
        chainMinutes += linked ? questMinutes(account, linked) : 0
      }
      if (!chainMinutes) continue
      if (!best || points / chainMinutes > best.points / best.minutes)
        best = { quest: facts.name, chain, points, minutes: chainMinutes }
    }
    if (!best) break
    for (const quest of best.chain) taken.add(quest)
    quests.push(best.quest)
    minutes += best.minutes
    left -= best.points
  }
  return { quests, minutes }
}

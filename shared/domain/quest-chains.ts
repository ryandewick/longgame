import { QUEST_FACTS } from '../data/quest-facts'

/*
 * Quest chains. A quest that requires another cannot be finished before it, so one fact about a
 * quest settles others: finishing Underground Pass means Biohazard and Plague City are finished
 * too, and not having finished Plague City means neither of the other two can be.
 *
 * The chains are the quest facts' `requires`: what each quest's page says must be finished first,
 * and Druidic Ritual behind a Herblore level. A quest that only has to be started is not part of a
 * chain, since finishing the later quest says nothing about whether it was finished.
 *
 * Only quests are chained. Nothing is inferred between diary tiers, or between a diary and a quest.
 */

/** The chains between quests, read in both directions and all the way along. */
export interface QuestChains {
  /** Every quest this one requires, directly or through another, in name order. */
  prerequisitesOf: (quest: string) => readonly string[]
  /** Every quest that requires this one, directly or through another, in name order. */
  dependantsOf: (quest: string) => readonly string[]
}

const NONE: readonly string[] = []

/** Everything that can be reached from each quest by following `links`, worked out once. */
function reachable(
  links: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, readonly string[]> {
  const reached = new Map<string, readonly string[]>()
  const from = (quest: string): readonly string[] => {
    const known = reached.get(quest)
    if (known) return known
    const found = new Set<string>()
    for (const next of links.get(quest) ?? NONE) {
      found.add(next)
      for (const further of from(next)) found.add(further)
    }
    const list = [...found].sort()
    reached.set(quest, list)
    return list
  }
  for (const quest of links.keys()) from(quest)
  return reached
}

/**
 * Follows each quest's direct requirements out to whole chains. `requires` must have no cycle,
 * which the data's builder has already refused.
 */
export function buildQuestChains(requires: ReadonlyMap<string, readonly string[]>): QuestChains {
  const requiredBy = new Map<string, string[]>()
  for (const [quest, required] of requires) {
    for (const prerequisite of required) {
      const dependants = requiredBy.get(prerequisite)
      if (dependants) dependants.push(quest)
      else requiredBy.set(prerequisite, [quest])
    }
  }
  const prerequisites = reachable(requires)
  const dependants = reachable(requiredBy)
  return {
    prerequisitesOf: (quest) => prerequisites.get(quest) ?? NONE,
    dependantsOf: (quest) => dependants.get(quest) ?? NONE,
  }
}

const CHAINS = buildQuestChains(
  new Map(
    QUEST_FACTS.filter((quest) => quest.requires.length).map((quest) => [
      quest.name,
      quest.requires,
    ]),
  ),
)

/** Every quest that must be finished before this one can be, in name order. */
export function questPrerequisites(quest: string): readonly string[] {
  return CHAINS.prerequisitesOf(quest)
}

/** Every quest that cannot be finished until this one is, in name order. */
export function questDependants(quest: string): readonly string[] {
  return CHAINS.dependantsOf(quest)
}

/**
 * The quests that cannot have been finished, given the ones the player has said are not: every
 * quest that requires one of them. The declined quests themselves are not in it.
 */
export function questsRuledOut(declinedQuests: Iterable<string>): ReadonlySet<string> {
  const ruledOut = new Set<string>()
  for (const declined of declinedQuests) {
    for (const dependant of questDependants(declined)) ruledOut.add(dependant)
  }
  return ruledOut
}

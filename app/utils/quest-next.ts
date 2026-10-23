import type { QuestState } from '#shared/types/quest'
import type { SkillKey } from '#shared/types/skill'
import { QUESTS } from '#shared/data/quests'
import { skillName } from '#shared/data/skills'
import { describeQuestRewards } from '#shared/domain/quests'
import type { BoostedLevel } from '#shared/domain/readiness'
import type { PlacedXp } from '#shared/domain/reward-hours'
import {
  skillsOpened,
  type QuestSuggestion,
  type TierSuggestion,
  type UnlockSuggestion,
} from '#shared/domain/suggestions'
import { formatMinutes } from './format'
import { savingFigure, type SavingFigure } from './quest-questions'
import { readinessLine } from './quest-readiness'
import { goalStepWords, listInWords, longTaskWords, tierRewardWords } from './quest-words'

/*
 * What the Quests page's Next part says: a row for each quest that saves hours, each unlock in
 * the account's guide's order, and each diary tier it can claim, with the button that marks it.
 */

/** A row has room for this many skill icons. */
const MOST_SKILL_ICONS = 4

/** The button on a row, which moves its quest or tier on. */
export interface NextAction {
  readonly label: 'Mark done' | 'Mark started'
  /** What a screen reader hears: 'Mark done: Lunar Diplomacy'. */
  readonly ariaLabel: string
}

function action(label: NextAction['label'], name: string): NextAction {
  return { label, ariaLabel: `${label}: ${name}` }
}

/** The boosts a row counts on, each named once: 'With a super fishing potion.' Empty for none. */
function boostWords(boosted: readonly BoostedLevel[]): string {
  const phrases = [...new Set(boosted.map(({ boost }) => boost.boost.phrase))]
  return phrases.length ? `With ${listInWords(phrases, 3)}.` : ''
}

/** A quest worth doing for the hours it saves, as its row says it. */
export interface SavingRow {
  readonly name: string
  /** The first few skills what it opens trains, for their icons. */
  readonly skills: readonly SkillKey[]
  /** What it opens and what it pays: 'Opens Red crabs and Keel parts. Pays Sailing 300.' */
  readonly gives: string
  /** The quests to do before it: "First: Twilight's Promise." Empty when there are none. */
  readonly first: string
  /** Where its XP with a choice of skill goes (decision 3): 'Put both rewards on Agility…' */
  readonly advice: string
  /** The boost it counts on: 'With a super fishing potion.' Empty for none. */
  readonly boost: string
  readonly saves: SavingFigure
  readonly takes: string
  readonly action: NextAction
}

/** Where a quest's XP with a choice of skill goes, in a sentence. Empty when it pays none. */
export function adviceWords(placed: readonly PlacedXp[]): string {
  if (!placed.length) return ''
  const skills = [...new Set(placed.map(({ skill }) => skillName(skill)))]
  const rewards =
    placed.length === 1
      ? 'the reward'
      : placed.length === 2
        ? 'both rewards'
        : `the ${placed.length} rewards`
  const why = placed.some(({ reason }) => reason === 'level')
    ? 'a goal ahead needs the level'
    : placed.length === 1
      ? 'where it saves the most hours'
      : 'where they save the most hours'
  return `Put ${rewards} on ${listInWords(skills, 3)}: ${why}.`
}

/** The rows of "Saves you training time", in the order given. */
export function savingRows(suggestions: readonly QuestSuggestion[]): SavingRow[] {
  return suggestions.flatMap((suggestion) => {
    const saves = savingFigure(suggestion.hoursSaved)
    if (!saves) return []
    const name = suggestion.quest.name
    const opens = suggestion.effect.opens.length
      ? `Opens ${listInWords(suggestion.effect.opens, 2)}.`
      : ''
    const quest = QUESTS.find((each) => each.name === name)
    const rewards = quest ? describeQuestRewards(quest) : ''
    // with no fixed XP the rewards are the lamps' sentence ('Six 15,000 xp lamps…'), read on from 'Pays'
    const lampsOnly = quest !== undefined && !Object.keys(quest.fixedXp).length
    const paid = lampsOnly ? `${rewards.charAt(0).toLowerCase()}${rewards.slice(1)}` : rewards
    const pays = paid ? `Pays ${paid.endsWith('.') ? paid : `${paid}.`}` : ''
    const first = suggestion.first.map(({ quest: each, state }) =>
      state === 'started' ? `start ${each}` : each,
    )
    return [
      {
        name,
        skills: skillsOpened(suggestion).slice(0, MOST_SKILL_ICONS),
        gives: [opens, pays].filter(Boolean).join(' '),
        first: first.length ? `First: ${listInWords(first, 4)}.` : '',
        advice: adviceWords(suggestion.placed),
        boost: boostWords(suggestion.boosted),
        saves,
        takes: formatMinutes(suggestion.minutes),
        action: action('Mark done', name),
      },
    ]
  })
}

/** An unlock in the account's guide's order, as its row says it. */
export interface OpensRow {
  readonly goal: string
  /** The next quest towards it. */
  readonly name: string
  /** What the quest is to the goal: 'Fairy rings: start it to get there.', 'Temple Trekking: the last quest left.' */
  readonly about: string
  /**
   * What stands in the way, in one line: what the quest needs when the account is not ready for
   * it ('Needs 25 Agility.'), and what the goal needs beyond its quests ('Piety and Chivalry is
   * short of 70 Prayer (you have 52).'). Empty when nothing does.
   */
  readonly warning: string
  /** How far its button takes the quest: finished, or only started. */
  readonly state: QuestState
  /** Where the account's guide reaches the goal. */
  readonly step: number
  readonly takes: string
  readonly action: NextAction
}

/** The rows of "Opens the game", in the order given. */
export function opensRows(unlocks: readonly UnlockSuggestion[]): OpensRow[] {
  return unlocks.map(({ goal, step, next, readiness, minutes, standing }) => {
    const about = goalStepWords(goal.name, standing.steps.length, next.state)
    const stepSkills = new Set(
      readiness.missing.flatMap((gap) => (gap.kind === 'skill' ? [gap.skill] : [])),
    )
    const beyond = standing.levelsShort.filter(({ skill }) => !stepSkills.has(skill))
    const short = beyond.length
      ? `${goal.name} is short of ${listInWords(
          beyond.map(({ skill, level, has }) => `${level} ${skillName(skill)} (you have ${has})`),
          3,
        )}.`
      : ''
    return {
      goal: goal.name,
      name: next.quest,
      about,
      warning: [readiness.missing.length ? `${readinessLine(readiness)}.` : '', short]
        .filter(Boolean)
        .join(' '),
      state: next.state,
      step,
      takes: minutes ? formatMinutes(minutes) : '',
      action: action(next.state === 'started' ? 'Mark started' : 'Mark done', next.quest),
    }
  })
}

/** A diary tier the account can claim, as its row says it. */
export interface TierRow {
  readonly name: string
  /** Its reward: 'Wilderness sword 1 and Runes from Lundail, with a 2,500 xp lamp.' */
  readonly reward: string
  /** A count to build up once the rest is done, a long task of its own (decision 6). */
  readonly longTask: string
  readonly boost: string
  readonly takes: string
  readonly action: NextAction
}

/** The rows of "Diary tiers you can claim", in the order given. */
export function tierRows(tiers: readonly TierSuggestion[]): TierRow[] {
  return tiers.map(({ diary, opens, minutes, boosted }) => ({
    name: diary.name,
    reward: tierRewardWords(diary, opens),
    longTask: longTaskWords(diary),
    boost: boostWords(boosted),
    takes: formatMinutes(minutes),
    action: action('Mark done', diary.name),
  }))
}

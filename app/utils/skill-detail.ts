import type { Account } from '#shared/types/account'
import type { Quest } from '#shared/types/quest'
import type { SkillKey, SkillStat } from '#shared/types/skill'
import { skillDefinition } from '#shared/data/skills'
import { hasCompletedQuest } from '#shared/domain/account'
import { formatHours, formatNumber, formatShortNumber } from '#shared/domain/format'
import { describeMissingRequirement } from '#shared/domain/requirements'
import { MAX_LEVEL, xpToMax, xpToNextLevel } from '#shared/domain/xp'
import type { SkillInsight } from '../stores/account'

/** A run of text in a sentence. The names in it (a method, a quest) are set strong. */
export interface TextSegment {
  readonly text: string
  readonly strong: boolean
}

const plain = (text: string): TextSegment => ({ text, strong: false })
const strong = (text: string): TextSegment => ({ text, strong: true })

/** A quest that still pays XP into a skill. */
export interface QuestOwingXp {
  readonly name: string
  readonly xp: number
}

/** How many days of XP snapshots a skill's pace is measured over, wherever a pace is quoted. */
export const SKILL_PACE_DAYS = 7

/** The detail never lists more quests than this: the rest are on the Quests page. */
const QUESTS_LISTED_MAXIMUM = 5

/** The quests the account has not finished that pay fixed XP into this skill, the most XP first. */
export function questsOwingXp(
  account: Account,
  skill: SkillKey,
  quests: readonly Quest[],
): QuestOwingXp[] {
  return quests
    .flatMap((quest) => {
      const xp = quest.fixedXp[skill]
      return xp && !hasCompletedQuest(account, quest.name) ? [{ name: quest.name, xp }] : []
    })
    .sort((first, second) => second.xp - first.xp)
}

/** '1,161,433 xp. 11,872,998 to 99, 49k to 75.' */
export function skillXpSentence(stat: SkillStat): string {
  const progress =
    stat.level >= MAX_LEVEL
      ? 'Maxed.'
      : `${formatNumber(xpToMax(stat))} to ${MAX_LEVEL}, ` +
        `${formatShortNumber(xpToNextLevel(stat))} to ${stat.level + 1}.`
  return `${formatNumber(stat.xp)} xp. ${progress}`
}

/**
 * What to train the skill with now and how long that leaves, with every caveat the figure
 * carries, then the player's own pace when the snapshots give one.
 */
export function bestNowSentence(
  insight: SkillInsight,
  isIronman: boolean,
  xpPerDay: number,
): TextSegment[] {
  const pace =
    xpPerDay > 0 ? ` Your ${SKILL_PACE_DAYS}-day pace is ${formatShortNumber(xpPerDay)} a day.` : ''
  if (skillDefinition(insight.skill).passive) {
    return [plain(`Trains itself through combat. It needs no plan of its own.${pace}`)]
  }
  const best = insight.fastestMethod
  if (!best) {
    return [plain(`No method available yet. Check the requirements in the table.${pace}`)]
  }

  const { method } = best
  // a rate worked out from the account's own levels is an estimate; the rest are the wiki's.
  // A method with no rate at all says nothing here: the caveat below owns up to the rough figure.
  const rate = best.xpPerHour
    ? ` at ${method.computedRate ? 'an estimated ' : '≈'}${formatShortNumber(best.xpPerHour)}/h`
    : ''
  const timeLeft = insight.daysLeft
    ? `${Math.round(insight.daysLeft)} days at one of each run a day`
    : formatHours(insight.hoursLeft)
  const caveats =
    (insight.isRough
      ? ' The wiki gives no hourly rate for part of that, so it is a rough figure.'
      : '') +
    (isIronman && method.usesOwnSupplies
      ? ' That rate only holds while your own supplies last.'
      : '')
  return [
    plain('Best now: '),
    strong(method.name),
    plain(
      `${rate}${method.timedRun ? ' of time spent on the runs' : ''}, ` +
        `about ${timeLeft} to ${MAX_LEVEL}.${caveats}${pace}`,
    ),
  ]
}

/** 'Next unlock: Blisterwood tree at level 62, needs Sins of the Father.' Null when nothing is left to unlock. */
export function nextUnlockSentence(insight: SkillInsight): TextSegment[] | null {
  const next = insight.nextUnlock
  if (!next) return null
  const level = next.method.level > insight.stat.level ? ` at level ${next.method.level}` : ''
  const needs = next.missing.length
    ? `, needs ${next.missing.map(describeMissingRequirement).join(', ')}`
    : ''
  return [plain('Next unlock: '), strong(next.method.name), plain(`${level}${needs}.`)]
}

/** 'Quests still owing XP here: Grim Tales 60k, Song of the Elves 40k.' Null when none owe any. */
export function questsOwingSentence(quests: readonly QuestOwingXp[]): TextSegment[] | null {
  if (!quests.length) return null
  const listed = quests
    .slice(0, QUESTS_LISTED_MAXIMUM)
    .flatMap((quest, index) => [
      ...(index > 0 ? [plain(', ')] : []),
      strong(quest.name),
      plain(` ${formatShortNumber(quest.xp)}`),
    ])
  return [plain('Quests still owing XP here: '), ...listed, plain('.')]
}

/**
 * The paragraphs under a skill's name, in order: its XP, then (until it is 99) what to do now,
 * what unlocks next and which quests still pay into it.
 */
export function skillDetailParagraphs(
  insight: SkillInsight,
  isIronman: boolean,
  xpPerDay: number,
  questsOwing: readonly QuestOwingXp[],
): TextSegment[][] {
  const xp = [plain(skillXpSentence(insight.stat))]
  if (insight.stat.level >= MAX_LEVEL) return [xp]
  const further = [nextUnlockSentence(insight), questsOwingSentence(questsOwing)]
  return [
    xp,
    bestNowSentence(insight, isIronman, xpPerDay),
    ...further.filter((sentence) => sentence !== null),
  ]
}

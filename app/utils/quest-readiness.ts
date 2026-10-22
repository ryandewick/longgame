import type { Account } from '#shared/types/account'
import type { ChoiceItem, NeedChoice } from '#shared/types/diary'
import type { LevelNeed } from '#shared/types/quest'
import { DIARY_REGIONS } from '#shared/data/diaries'
import { DIARY_FACTS } from '#shared/data/diary-facts'
import { skillName } from '#shared/data/skills'
import { hasCompletedDiary } from '#shared/domain/account'
import { formatNumber } from '#shared/domain/format'
import { diaryReadiness, type Readiness, type ReadinessGap } from '#shared/domain/readiness'

/*
 * What the tick list says about a quest or a diary tier that is not done: ready, ready with a
 * boost, or what it still needs. A short line for the row, and a sentence with the account's own
 * figures for a screen reader and a tooltip.
 */

/** How many needs a short line names before it counts the rest. */
const SHORT_LINE_NEEDS = 3

/** A level in words: '62 Fishing'. */
function levelWords({ skill, level }: LevelNeed): string {
  return `${level} ${skillName(skill)}`
}

/** One thing an either-or need can be met with, in words. */
function choiceItemWords(item: ChoiceItem): string {
  switch (item.kind) {
    case 'skill':
      return levelWords(item)
    case 'quest':
      return item.state === 'started' ? `${item.quest} started` : item.quest
    case 'combat':
      return `combat level ${item.level}`
    case 'other':
      return item.text
  }
}

/** An either-or need in words: 'combat level 100 or 99 Slayer'. */
export function choiceWords(choice: NeedChoice): string {
  return choice.options.map((option) => option.map(choiceItemWords).join(' and ')).join(' or ')
}

/** Options of levels in words: '59 Fletching and 59 Smithing, or 35 Firemaking'. */
function optionsWords(options: readonly (readonly LevelNeed[])[]): string {
  const each = options.map((option) => option.map(levelWords).join(' and '))
  return each.length > 1 && options.some((option) => option.length > 1)
    ? each.join(', or ')
    : each.join(' or ')
}

/** One gap in a few words, for a short line: '62 Fishing', 'Ratcatchers started'. */
export function gapWords(gap: ReadinessGap): string {
  switch (gap.kind) {
    case 'lower-tier':
      return `${gap.diary} first`
    case 'quest':
      return gap.state === 'started' ? `${gap.quest} started` : gap.quest
    case 'skill':
      return levelWords(gap)
    case 'quest-points':
      return `${formatNumber(gap.needed)} quest points`
    case 'combat':
      return `combat level ${gap.level}`
    case 'kudos':
      return `${formatNumber(gap.needed)} Kudos`
    case 'choice':
      return choiceWords(gap.choice)
    case 'all-quests':
      return 'every quest'
    case 'ironman':
      return gap.need ? `${gap.need} to make` : `${optionsWords(gap.options)} as an ironman`
  }
}

/**
 * One gap with the account's own figures: '62 Fishing (you have 57; a super fishing potion covers
 * it once you have 62 Herblore)', '153 Kudos (your quests and the museum give 95 so far)'.
 */
export function gapInFull(gap: ReadinessGap): string {
  switch (gap.kind) {
    case 'skill': {
      const notes = [`you have ${gap.has}`]
      if (gap.nearestBoost) {
        const { boost, unlockedBy } = gap.nearestBoost
        notes.push(`${boost.phrase} covers it once you have ${levelWords(unlockedBy)}`)
      }
      if (gap.raiments)
        notes.push(
          `${gap.raiments.level} is enough with ${gap.raiments.pieces} or more Raiments of the Eye pieces`,
        )
      return `${levelWords(gap)} (${notes.join('; ')})`
    }
    case 'quest-points':
    case 'combat':
      return `${gapWords(gap)} (you have ${gap.has})`
    case 'kudos':
      return `${gapWords(gap)} (your quests and the museum give ${gap.withinReach} so far)`
    case 'all-quests':
      return `every quest (${gap.left} left)`
    case 'ironman':
      return gap.need ? `${gapWords(gap)} (${optionsWords(gap.options)})` : gapWords(gap)
    default:
      return gapWords(gap)
  }
}

/**
 * Items in words: 'a, b and c', or with a semicolon between them when one has a comma of its own
 * outside brackets.
 */
function joinWords(items: readonly string[]): string {
  const last = items.at(-1)
  if (last === undefined) return ''
  if (items.length === 1) return last
  const head = items.slice(0, -1)
  return items.some((item) => item.replace(/\([^)]*\)/g, '').includes(','))
    ? `${head.join('; ')}; and ${last}`
    : `${head.join(', ')} and ${last}`
}

/** The boosts a ready quest or tier counts on, each named once: 'a super fishing potion'. */
function boostWords(readiness: Readiness): string {
  return joinWords([...new Set(readiness.boosted.map(({ boost }) => boost.boost.phrase))])
}

/** The lower tiers a tier still needs, as one item: 'Wilderness Easy first', 'the three tiers below it first'. */
function lowerTiersWords(lower: readonly string[]): string {
  const [first, second] = lower
  if (lower.length === 1 && first) return `${first} first`
  if (lower.length === 2 && first && second)
    return `${first} and ${second.slice(second.lastIndexOf(' ') + 1)} first`
  return 'the three tiers below it first'
}

/** The needs in words, the lower tiers of a diary as one item, then the rest each in its own words. */
function needsInWords(readiness: Readiness, words: (gap: ReadinessGap) => string): string[] {
  const lower = readiness.missing.flatMap((gap) => (gap.kind === 'lower-tier' ? [gap.diary] : []))
  const rest = readiness.missing.filter((gap) => gap.kind !== 'lower-tier').map(words)
  return lower.length ? [lowerTiersWords(lower), ...rest] : rest
}

/**
 * A row's short line: 'Ready', 'Ready with a super fishing potion', or 'Needs 62 Fishing,
 * Grim Tales and 2 more'.
 */
export function readinessLine(readiness: Readiness): string {
  if (!readiness.missing.length)
    return readiness.boosted.length ? `Ready with ${boostWords(readiness)}` : 'Ready'
  const needs = needsInWords(readiness, gapWords)
  const shown = needs.slice(0, SHORT_LINE_NEEDS)
  const left = needs.length - shown.length
  return `Needs ${joinWords(left > 0 ? [...shown, `${left} more`] : shown)}`
}

/** The whole of it in a sentence, with the account's own figures, for a label or a detail. */
export function readinessSentence(readiness: Readiness): string {
  if (!readiness.missing.length) return `${readinessLine(readiness)}.`
  return `Needs ${joinWords(needsInWords(readiness, gapInFull))}.`
}

/** What a row says about a quest or a diary tier not done. */
export interface RowReadiness {
  /** Nothing it needs is missing. The line may still name a boost it counts on. */
  readonly ready: boolean
  /** The short line under the name: 'Ready with a super fishing potion', 'Needs Grim Tales'. */
  readonly line: string
  /** The whole of it with the account's own figures, for a screen reader and a tooltip. */
  readonly sentence: string
}

/** A quest's or a tier's readiness as its row says it. */
export function rowReadiness(readiness: Readiness): RowReadiness {
  return {
    ready: !readiness.missing.length,
    line: readinessLine(readiness),
    sentence: readinessSentence(readiness),
  }
}

/** A diary's next tier, as the list under the diary grid says it. */
export interface DiaryNextRow extends RowReadiness {
  readonly region: string
  /** The lowest tier not claimed, 'Ardougne Hard'; null once all four are. */
  readonly diary: string | null
}

/**
 * Each diary's next tier, region by region, and what it needs. A tier's reward needs the tiers
 * below it claimed, so the lowest one not claimed is the one to do. A ready tier also says what it
 * still has to build up (100% favour in Tai Bwo Wannai), a long task of its own (decision 6).
 */
export function diaryNextRows(account: Account): DiaryNextRow[] {
  return DIARY_REGIONS.map((region) => {
    const next = DIARY_FACTS.find(
      (diary) => diary.region === region && !hasCompletedDiary(account, diary.name),
    )
    if (!next) {
      const line = 'All four tiers claimed'
      return { region, diary: null, ready: false, line, sentence: `${line}.` }
    }
    const said = rowReadiness(diaryReadiness(account, next))
    const toBuild = joinWords(next.longTasks.map((task) => task.text))
    if (!said.ready || !toBuild) return { region, diary: next.name, ...said }
    return {
      region,
      diary: next.name,
      ready: true,
      line: `${said.line}; still to build: ${toBuild}`,
      sentence: `${said.sentence} Still to build: ${toBuild}.`,
    }
  })
}

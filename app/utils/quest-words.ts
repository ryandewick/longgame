import type { DiaryFacts } from '#shared/types/diary'
import type { QuestState } from '#shared/types/quest'
import { formatNumber } from '#shared/domain/format'

/*
 * Phrases the Quests page and Tonight both say: lists and lengths of time in a sentence, what a
 * quest is to a goal, and a diary tier's reward. They are kept apart from the Quests page's own
 * text builders because Tonight's words load on every planner page (the rack uses them), and
 * those builders would bring the suggestion rules along.
 */

/** A length of time in a sentence: '45 minutes', '1 hour', '432 hours'. */
export function hoursInWords(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`
  const whole = Math.round(hours)
  return whole === 1 ? '1 hour' : `${formatNumber(whole)} hours`
}

/**
 * Names as a list in a sentence: 'A', 'A and B', 'A, B and C'. Past `most` names the rest are
 * counted: 'A, B, C and 4 more'. Where a name has a comma of its own ('Antifire, ranging, magic
 * potions') the names are set apart by semicolons instead, so the list still reads as one.
 */
export function listInWords(names: readonly string[], most = 3): string {
  const shown = names.slice(0, most)
  const left = names.length - shown.length
  const items = left > 0 ? [...shown, `${left} more`] : shown
  const last = items.at(-1)
  if (last === undefined) return ''
  if (items.length === 1) return last
  const hasComma = shown.some((name) => name.includes(','))
  const head = items.slice(0, -1)
  return hasComma ? `${head.join('; ')}; and ${last}` : `${head.join(', ')} and ${last}`
}

/**
 * What a quest is to a goal: 'Fairy rings: start it to get there.', 'Temple Trekking: the last
 * quest left.' `left` counts the goal's quests still to do, this one included.
 */
export function goalStepWords(goal: string, left: number, state: QuestState): string {
  const more = left === 2 ? 'with 1 more after it' : `with ${left - 1} more after it`
  return state === 'started'
    ? `${goal}: start it${left === 1 ? ' to get there' : `, ${more}`}.`
    : `${goal}: ${left === 1 ? 'the last quest left' : `the next quest, ${more}`}.`
}

/**
 * A tier's reward in a sentence, with the methods and resets it opens: 'Wilderness sword 1 and
 * Runes from Lundail, with a 2,500 xp lamp.' Empty for none.
 */
export function tierRewardWords(diary: DiaryFacts, opens: readonly string[]): string {
  const things = listInWords([...diary.items, ...opens], 6)
  const lamp = diary.lamp ? `a ${formatNumber(diary.lamp.xp)} xp lamp` : ''
  const reward = things && lamp ? `${things}, with ${lamp}` : things || lamp
  return reward ? `${reward.charAt(0).toUpperCase()}${reward.slice(1)}.` : ''
}

/** A tier's counts to build up once the rest is done, a long task of its own (decision 6). Empty for none. */
export function longTaskWords(diary: DiaryFacts): string {
  const tasks = diary.longTasks.map(({ text }) => text)
  return tasks.length ? `Then, as a long task of its own: ${listInWords(tasks, 3)}.` : ''
}

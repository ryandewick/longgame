import type { ChoiceItem, DiaryFacts, DiaryGate, LongTask, NeedChoice } from '../types/diary'
import type { LevelNeed, QuestFacts, QuestState } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { DIARY_REGIONS, DIARY_TIERS } from './diaries'
import { isLevel, readCount, readLevelNeed, readMinutes, readSkillList } from './read-needs'
import { isSkillKey } from './skills'
import { DataSourceError } from './sources'
import type { ChoiceItemSource, DiaryFactSource } from './sources'

const STATES: readonly string[] = ['finished', 'started']

/** The Raiments of the Eye: hat, top, bottoms and boots. */
const RAIMENTS_PIECES = 4

const isState = (state: string): state is QuestState => STATES.includes(state)

/** One item of an either-or choice, or null (with the problem noted) when it is not a sound one. */
function choiceItem(
  problems: string[],
  where: string,
  item: ChoiceItemSource,
  quests: ReadonlyMap<string, QuestFacts>,
): ChoiceItem | null {
  const set = [item.skill, item.quest, item.combat, item.other].filter((part) => part !== undefined)
  if (set.length !== 1) {
    problems.push(`${where}: a choice item that is not one thing`)
    return null
  }
  if (item.skill !== undefined) {
    if (!isSkillKey(item.skill) || item.level === undefined || !isLevel(item.level)) {
      problems.push(`${where}: a choice of ${item.skill} ${item.level}`)
      return null
    }
    return {
      kind: 'skill',
      skill: item.skill,
      level: item.level,
      boostable: item.boostable === true,
    }
  }
  if (item.quest !== undefined) {
    if (!quests.has(item.quest))
      problems.push(`${where}: a choice of '${item.quest}', not a quest entry`)
    if (!item.state || !isState(item.state)) {
      problems.push(`${where}: a choice of '${item.quest}' ${item.state}`)
      return null
    }
    return { kind: 'quest', quest: item.quest, state: item.state }
  }
  if (item.combat !== undefined) {
    if (!(Number.isInteger(item.combat) && item.combat >= 3 && item.combat <= 126)) {
      problems.push(`${where}: a choice of combat ${item.combat}`)
      return null
    }
    return { kind: 'combat', level: item.combat }
  }
  if (!item.other?.trim()) {
    problems.push(`${where}: a choice of nothing`)
    return null
  }
  return { kind: 'other', text: item.other }
}

/**
 * Turns datasrc/diary_facts.json into the app's `DiaryFacts`, one per tier, in the game's order:
 * region by region, easiest tier first. Every field is checked: exactly the 48 tiers the app
 * knows, a page and revision for each, quests that are entries of the quest facts, each needed
 * finished or started, a quest needed started that the quest facts mark as mattering started, and
 * the quests planned on finished among the ones read started. What readiness reads is checked too:
 * levels from 1 to 99 in skills the app knows (the boostable ones among them), a Raiments of the
 * Eye level below the tier's Runecraft, sound either-or choices, whole-number counts, the
 * ironman's levels, the counts to build up, and gates that are methods or resets. So is what
 * suggestions read: the minutes of its tasks, in order, and its reward's items and lamp.
 *
 * Throws a DataSourceError listing everything wrong with the source.
 */
export function buildDiaryFacts(
  source: Readonly<Record<string, DiaryFactSource>>,
  questFacts: readonly QuestFacts[],
): DiaryFacts[] {
  const problems: string[] = []
  const quests = new Map(questFacts.map((quest) => [quest.name, quest]))
  const facts: DiaryFacts[] = []

  for (const region of DIARY_REGIONS) {
    for (const tier of DIARY_TIERS) {
      const name = `${region} ${tier}`
      const entry = source[name]
      if (!entry) {
        problems.push(`${name}: missing`)
        continue
      }
      if (!entry.page.trim()) problems.push(`${name}: no page`)
      if (!(Number.isInteger(entry.rev) && entry.rev > 0))
        problems.push(`${name}: revision ${entry.rev}`)

      const needs: Record<string, QuestState> = {}
      for (const [quest, state] of Object.entries(entry.quests)) {
        const known = quests.get(quest)
        if (!known) problems.push(`${name}: needs '${quest}', which is not a quest entry`)
        if (!isState(state)) {
          problems.push(`${name}: needs '${quest}' ${state}`)
          continue
        }
        if (known && state === 'started' && !known.startedMatters)
          problems.push(
            `${name}: needs '${quest}' started, which is not marked as mattering started`,
          )
        needs[quest] = state
      }
      for (const quest of entry.planFinished ?? []) {
        if (needs[quest] !== 'started')
          problems.push(`${name}: plans '${quest}' finished, which it does not read started`)
      }

      const levels: Partial<Record<SkillKey, number>> = {}
      for (const [skill, level] of Object.entries(entry.levels ?? {})) {
        const need = readLevelNeed(problems, name, { skill, level })
        if (need) levels[need.skill] = need.level
      }

      const raiments = entry.raiments ?? null
      if (
        raiments &&
        !(
          isLevel(raiments.level) &&
          raiments.level < (levels.runecraft ?? 0) &&
          Number.isInteger(raiments.pieces) &&
          raiments.pieces >= 1 &&
          raiments.pieces <= RAIMENTS_PIECES
        )
      )
        problems.push(`${name}: ${raiments.level} Runecraft with ${raiments.pieces} pieces`)

      const choices: NeedChoice[] = (entry.choices ?? []).map((choice) => {
        if (choice.options.length < 2) problems.push(`${name}: a choice of fewer than two options`)
        return {
          options: choice.options.map((option) =>
            option.flatMap((item) => choiceItem(problems, name, item, quests) ?? []),
          ),
          note: choice.note?.trim() || null,
        }
      })

      const ironman: LevelNeed[] = (entry.ironman ?? []).flatMap(
        (need) => readLevelNeed(problems, `${name} ironman`, need) ?? [],
      )

      const longTasks: LongTask[] = (entry.longTasks ?? []).map((task) => {
        if (!(Number.isInteger(task.amount) && task.amount > 0) || !task.unit.trim())
          problems.push(`${name}: a long task of ${task.amount} ${task.unit}`)
        return { amount: task.amount, unit: task.unit, text: task.text }
      })

      const minutes = entry.minutes ? readMinutes(problems, name, entry.minutes) : null
      if (!entry.minutes) problems.push(`${name}: no minutes`)
      const lamp = entry.lamp ?? null
      if (
        lamp &&
        !(
          Number.isInteger(lamp.xp) &&
          lamp.xp > 0 &&
          (lamp.minLevel === 0 || isLevel(lamp.minLevel))
        )
      )
        problems.push(`${name}: a lamp of ${lamp.xp} xp at level ${lamp.minLevel}`)
      const items = entry.items ?? []
      if (items.some((item) => !item.trim())) problems.push(`${name}: an item with no name`)

      const gates: DiaryGate[] = (entry.gates ?? []).flatMap((gate) => {
        if (gate.kind !== 'method' && gate.kind !== 'reset') {
          problems.push(`${name}: a gate of kind '${gate.kind}'`)
          return []
        }
        return [{ kind: gate.kind, name: gate.name }]
      })

      facts.push({
        name,
        region,
        tier,
        page: entry.page,
        revision: entry.rev,
        quests: needs,
        planFinished: [...(entry.planFinished ?? [])],
        levels,
        boostable: readSkillList(problems, name, 'boostable', entry.boostable, levels),
        raiments: raiments && { level: raiments.level, pieces: raiments.pieces },
        choices,
        questPoints: readCount(problems, name, 'quest points', entry.questPoints),
        combat: readCount(problems, name, 'combat level', entry.combat),
        kudos: readCount(problems, name, 'Kudos', entry.kudos),
        allQuests: entry.allQuests === true,
        ironman,
        longTasks,
        also: [...(entry.also ?? [])],
        gates,
        minutes: minutes ?? { low: 0, mid: 0, high: 0 },
        items: [...items],
        lamp: lamp && { xp: lamp.xp, minLevel: lamp.minLevel },
        recommended: entry.recommended === true,
      })
    }
  }

  const known = new Set(facts.map((diary) => diary.name))
  for (const name of Object.keys(source)) {
    if (!known.has(name)) problems.push(`'${name}': not a tier the app knows`)
  }
  if (problems.length)
    throw new DataSourceError(problems.map((problem) => `diary facts: ${problem}`))
  return facts
}

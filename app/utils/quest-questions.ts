import type { Account } from '#shared/types/account'
import type { Quest } from '#shared/types/quest'
import type { SkillKey } from '#shared/types/skill'
import { skillName } from '#shared/data/skills'
import { hasCompletedQuest } from '#shared/domain/account'
import { formatHours, formatNumber, formatShortNumber } from '#shared/domain/format'
import {
  SMALLEST_SAVING_IN_HOURS,
  gatedActivities,
  type PlanQuestion,
  type PlanRequirement,
} from '#shared/domain/plan-questions'
import type { QuestTicks } from '#shared/domain/quest-ticks'
import { questTotalXp } from '#shared/domain/quests'

/*
 * What the Quests page and the prompt on Tonight say: the question card, the list of answers
 * beside it, the tick list's rows and the page's three parts. The rules are the domain's
 * (shared/domain/plan-questions.ts and quest-ticks.ts); these put them into words.
 */

/** The three parts of the Quests page, as the address names them: /quests?tab=tick-list. */
export type QuestsTab = 'questions' | 'tick-list' | 'xp'

/** The three parts in the order their tabs stand in, each with its tab's words. */
export const QUESTS_TABS: readonly { readonly tab: QuestsTab; readonly label: string }[] = [
  { tab: 'questions', label: 'Questions' },
  { tab: 'tick-list', label: 'Tick list' },
  { tab: 'xp', label: 'Worth doing next for XP' },
]

/** The address that opens the Quests page at one of its parts. */
export function questsTabPath(tab: QuestsTab): string {
  return `/quests?tab=${tab}`
}

/**
 * Which part of the Quests page does this address open? The one its `tab` names. With none
 * named, or one this copy does not have, the questions while there are any to ask and the tick
 * list otherwise. A copy whose add-on fills quests in asks nothing, so it has no questions part.
 */
export function questsTabFor(
  tabInAddress: unknown,
  page: { readonly asksQuestions: boolean; readonly questionsWaiting: number },
): QuestsTab {
  const named = QUESTS_TABS.find(({ tab }) => tab === tabInAddress)?.tab
  if (named && (named !== 'questions' || page.asksQuestions)) return named
  return page.asksQuestions && page.questionsWaiting > 0 ? 'questions' : 'tick-list'
}

/** A requirement as a row names it: a quest by its name, a diary tier as 'Ardougne Medium diary'. */
export function requirementLabel(requirement: PlanRequirement): string {
  return requirement.kind === 'diary' ? `${requirement.name} diary` : requirement.name
}

/** A question in two parts, the way the card sets it: a quiet lead-in, then the subject large. */
export interface QuestionWording {
  readonly lead: string
  readonly subject: string
}

/** 'Have you finished' 'Sins of the Father?', or 'Have you completed the' 'Ardougne Medium diary?'. */
export function questionWording(requirement: PlanRequirement): QuestionWording {
  return requirement.kind === 'diary'
    ? { lead: 'Have you completed the', subject: `${requirement.name} diary?` }
    : { lead: 'Have you finished', subject: `${requirement.name}?` }
}

/** The whole question as one sentence, for a screen reader. */
export function questionSentence(requirement: PlanRequirement): string {
  const { lead, subject } = questionWording(requirement)
  return `${lead} ${subject}`
}

/** A saving for the game's font: the figure, and the unit that follows it. */
export interface SavingFigure {
  readonly figure: string
  readonly unit: string
}

/**
 * The hours a yes would save, as the card's large figure: '61' 'hours', '1' 'hour', or inside
 * the first hour '45' 'minutes'. Null when it saves too little to count (the domain's half hour),
 * in which case the card says so in a sentence.
 */
export function savingFigure(hoursSaved: number): SavingFigure | null {
  if (hoursSaved < SMALLEST_SAVING_IN_HOURS) return null
  if (hoursSaved < 1) return { figure: String(Math.round(hoursSaved * 60)), unit: 'minutes' }
  const hours = Math.round(hoursSaved)
  return { figure: formatNumber(hours), unit: hours === 1 ? 'hour' : 'hours' }
}

/** A smaller question's card says at most this many sentences about methods before it sums them up in one. */
const MOST_SENTENCES_OF_METHODS = 2

/**
 * What a smaller question's yes would add, said plainly where a bigger question shows its hours:
 * 'Adds Sand from Bert to your sessions.' for a timed run or a daily, 'Adds Karambwan as an
 * option for Cooking and Fishing.' for a method. Methods that train the same skills share a
 * sentence, and a quest that opens methods for more than two sets of skills gets one sentence
 * for them all, so the card never turns into a list.
 */
export function smallerQuestionAdds(question: PlanQuestion): string {
  const sentences: string[] = []
  const { resetsOpened } = question
  if (resetsOpened.length) sentences.push(`Adds ${listInWords(resetsOpened)} to your sessions.`)

  // a reset and the method behind it can share a name: it is said once, as the reset
  const methods = question.methodsOpened.filter((method) => !resetsOpened.includes(method.name))
  const asOptions = (names: readonly string[], skills: readonly string[]): string =>
    `Adds ${listInWords(names)} as ${names.length === 1 ? 'an option' : 'options'} for ${listInWords(skills)}.`

  const methodsBySkills = new Map<string, { names: string[]; skills: string[] }>()
  for (const method of methods) {
    const skills = method.skills.map(skillName)
    const group = methodsBySkills.get(skills.join()) ?? { names: [], skills }
    group.names.push(method.name)
    methodsBySkills.set(skills.join(), group)
  }
  if (methodsBySkills.size > MOST_SENTENCES_OF_METHODS) {
    const everySkill = [...new Set(methods.flatMap((method) => method.skills.map(skillName)))]
    sentences.push(
      asOptions(
        methods.map((method) => method.name),
        everySkill,
      ),
    )
  } else {
    for (const { names, skills } of methodsBySkills.values())
      sentences.push(asOptions(names, skills))
  }
  return sentences.join(' ')
}

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
 * What else an action changed, as its own sentence: 'Also ticked: Biohazard and Plague City.'
 * A long list is cut short with a count. Empty when the action changed nothing else.
 */
export function alsoChangedSentence(ticked: boolean, quests: readonly string[]): string {
  if (!quests.length) return ''
  return `Also ${ticked ? 'ticked' : 'unticked'}: ${listInWords(quests)}.`
}

/**
 * What an answer ticked beyond its own quest, for the card to show under the next question:
 * 'Bone Voyage ticked. Also ticked: Druidic Ritual and The Dig Site.' Empty when nothing.
 */
export function alsoChangedNotice(answer: GivenAnswer): string {
  const also = alsoChangedSentence(true, answer.alsoTicked)
  return also && `${requirementLabel(answer.requirement)} ticked. ${also}`
}

/** The two rounds of questions: the ones that save hours, then the smaller ones. */
export type QuestionRound = 'hours' | 'smaller'

/** Which round an answer was given in: a question that saved too little to count was a smaller one. */
function roundOf(answer: GivenAnswer): QuestionRound {
  return answer.hoursSaved < SMALLEST_SAVING_IN_HOURS ? 'smaller' : 'hours'
}

/**
 * Where a round has got to, for the line over the progress marks. Each round counts for itself:
 * the answers given in it this visit, and the questions it still has waiting, the one on the
 * card included.
 */
export function roundProgress(
  answers: readonly GivenAnswer[],
  waiting: number,
  round: QuestionRound,
): { readonly step: number; readonly total: number } {
  const answered = answers.filter((answer) => roundOf(answer) === round).length
  return { step: answered + 1, total: answered + waiting }
}

/** What the page says between the two rounds, when the questions that save hours are all answered. */
export interface SmallerRoundNote {
  readonly title: string
  /** How many smaller questions are left: '16 smaller questions are left.' */
  readonly left: string
  /** What they are for, and that they change no hours. */
  readonly purpose: string
  /** The words of the button that starts them. */
  readonly answerLabel: string
}

/** The pause between the rounds, for this many smaller questions. Null when there are none to offer. */
export function smallerRoundNote(count: number): SmallerRoundNote | null {
  if (count <= 0) return null
  const title = 'Your hours to max are now right'
  return count === 1
    ? {
        title,
        left: '1 smaller question is left.',
        purpose:
          'It adds a daily run or an alternative method to your plan. It does not change your hours to max.',
        answerLabel: 'Answer it now',
      }
    : {
        title,
        left: `${count} smaller questions are left.`,
        purpose:
          'They add daily runs and alternative methods to your plan. They do not change your hours to max.',
        answerLabel: 'Answer them now',
      }
}

/**
 * The line over the progress marks: 'Question 5 of at most 13'. The total is a ceiling, not a
 * promise: a yes ticks the quests that one requires and a "not yet" rules out the quests that
 * require it, so an answer can settle questions that were still waiting. Only the last question
 * of a round knows the count: 'Question 13 of 13'.
 */
export function stepLabel(step: number, total: number): string {
  return step >= total ? `Question ${step} of ${total}` : `Question ${step} of at most ${total}`
}

/** What the progress marks show, in words: '4 answered, at most 8 still to come after this one'. */
export function progressLabel(answered: number, toCome: number): string {
  return toCome > 0
    ? `${answered} answered, at most ${toCome} still to come after this one`
    : `${answered} answered, none still to come after this one`
}

/**
 * The foot of the card: how many other open requirements are not being asked about, and why.
 * In two parts, as the first is set stronger. Null when there are none.
 */
export function setAsideNote(
  count: number,
): { readonly lead: string; readonly rest: string } | null {
  if (count <= 0) return null
  const rest =
    'Long Game asks again when one starts to matter, for example when you reach the level for a method it unlocks. The full tick list is there if you want it.'
  return count === 1
    ? {
        lead: '1 other quest or diary tier is not asked about,',
        rest: `because it would not change your plan right now. ${rest}`,
      }
    : {
        lead: `${count} other quests and diary tiers are not asked about,`,
        rest: `because none of them would change your plan right now. ${rest}`,
      }
}

/**
 * The sentence of the prompt on Tonight: 'Up to 3 quick questions about your quests would sharpen
 * tonight’s plan.' Up to, because one answer can settle several (see `stepLabel`).
 */
export function questionsPrompt(count: number): string {
  const questions = count === 1 ? '1 quick question' : `Up to ${count} quick questions`
  return `${questions} about your quests would sharpen tonight’s plan.`
}

/** An answer given during this visit, as the list beside the card remembers it. */
export interface GivenAnswer {
  readonly requirement: PlanRequirement
  readonly done: boolean
  /** The hours the question said a yes would save, at the moment it was answered. */
  readonly hoursSaved: number
  /** The other quests a yes ticked along with it. */
  readonly alsoTicked: readonly string[]
}

/**
 * The answers that still stand. An answer can be undone on the tick list (a yes unticked, a
 * "not yet" ticked), and it then drops out of the list of answers: the question may come back.
 */
export function answersStanding(
  answers: readonly GivenAnswer[],
  ticks: QuestTicks,
): readonly GivenAnswer[] {
  return answers.filter(({ requirement: { kind, name }, done }) => {
    const completed = kind === 'quest' ? ticks.completedQuests : ticks.completedDiaries
    const declined = kind === 'quest' ? ticks.declinedQuests : ticks.declinedDiaries
    return (done ? completed : declined).includes(name)
  })
}

/** The hours the answers given so far have taken off the hours to max. */
export function hoursTakenOff(answers: readonly GivenAnswer[]): number {
  return answers.reduce((sum, answer) => sum + (answer.done ? answer.hoursSaved : 0), 0)
}

/** A row of the list beside the card: an answer given, the question on the card, or one to come. */
export interface AnswerRow {
  readonly key: string
  readonly name: string
  readonly state: 'done' | 'not-yet' | 'asking' | 'to-come'
  /** What the state is called: 'Done', 'Not yet', 'Asking now'. Empty for a question to come. */
  readonly stateLabel: string
  /** A saving made, for the game's font: '−291 h'. Empty when there is none. */
  readonly saved: string
  /** A saving that may come, in plain words: 'up to 45 h'. Empty except for a question to come. */
  readonly mayCome: string
  /** For a question to come: its saving as a share of the biggest still on offer, 0 to 100. */
  readonly share: number
  /** What else a yes settled: 'and 2 quests it requires'. Empty when nothing. */
  readonly note: string
}

const rowKey = ({ kind, name }: PlanRequirement): string => `${kind}:${name}`

/**
 * The list beside the card: the answers given, oldest first, then the question on the card, then
 * the ones still to come in the order they will be asked. A saving that may come is "up to" so
 * much, because an earlier answer can shrink it.
 */
export function answerRows(
  answers: readonly GivenAnswer[],
  questions: readonly PlanQuestion[],
): AnswerRow[] {
  const given = answers.map((answer): AnswerRow => {
    const settled = answer.alsoTicked.length
    const saves = answer.done && answer.hoursSaved >= SMALLEST_SAVING_IN_HOURS
    return {
      key: rowKey(answer.requirement),
      name: requirementLabel(answer.requirement),
      state: answer.done ? 'done' : 'not-yet',
      stateLabel: answer.done ? 'Done' : 'Not yet',
      saved: saves ? `−${formatHours(answer.hoursSaved)}` : '',
      mayCome: '',
      share: 0,
      note: settled ? `and ${settled === 1 ? '1 quest' : `${settled} quests`} it requires` : '',
    }
  })
  const [, ...later] = questions
  const biggest = Math.max(0, ...later.map((question) => question.hoursSaved))
  const waiting = questions.map((question, place): AnswerRow => {
    const isAsking = place === 0
    const saves = question.hoursSaved >= SMALLEST_SAVING_IN_HOURS
    return {
      key: rowKey(question.requirement),
      name: requirementLabel(question.requirement),
      state: isAsking ? 'asking' : 'to-come',
      stateLabel: isAsking ? 'Asking now' : '',
      saved: '',
      mayCome: isAsking
        ? ''
        : saves
          ? `up to ${formatHours(question.hoursSaved)}`
          : 'adds to your plan',
      share: isAsking || !biggest ? 0 : Math.round((question.hoursSaved / biggest) * 100),
      note: '',
    }
  })
  return [...given, ...waiting]
}

/** A question about to be asked, with its place in its round. */
export interface QuestionInTurn {
  readonly question: PlanQuestion
  readonly step: number
  readonly total: number
}

/**
 * What follows an answer: the next question, the pause before this many smaller questions, or
 * nothing at all.
 */
export type AfterAnswer = QuestionInTurn | { readonly smallerLeft: number } | null

/** A question as a screen reader hears it: 'Question 2 of at most 10. Have you finished Bone Voyage?' */
export function questionAnnouncement({ question, step, total }: QuestionInTurn): string {
  return `${stepLabel(step, total)}. ${questionSentence(question.requirement)}`
}

/** What a screen reader hears after an answer: the answer, what else it ticked, then what follows. */
export function answerAnnouncement(answer: GivenAnswer, after: AfterAnswer): string {
  let follows = 'No more questions.'
  if (after && 'question' in after) follows = questionAnnouncement(after)
  else if (after) {
    const pause = smallerRoundNote(after.smallerLeft)
    if (pause) follows = `${pause.title}. ${pause.left} ${pause.purpose}`
  }
  const parts = [
    `${requirementLabel(answer.requirement)}: ${answer.done ? 'done' : 'not yet'}.`,
    alsoChangedSentence(true, answer.alsoTicked),
    follows,
  ]
  return parts.filter(Boolean).join(' ')
}

/** What the page says once nothing is left to ask, after the answers of this visit. */
export function questionsDoneSummary(answers: readonly GivenAnswer[]): string {
  if (!answers.length) return 'Long Game has nothing to ask you right now.'
  const count = answers.length === 1 ? '1 answer' : `${answers.length} answers`
  const hours = hoursTakenOff(answers)
  return hours >= SMALLEST_SAVING_IN_HOURS
    ? `Your ${count} took ${hoursInWords(hours)} off your hours to max.`
    : `Your ${count} took no hours off, but the plan now knows what it can deal you.`
}

/** A quest that unlocks something, as the tick list shows it. */
export interface UnlockRow {
  readonly name: string
  readonly done: boolean
  /** What it stands in front of: 'Hardwood tree runs, Drift net fishing and 8 more'. */
  readonly opens: string
  /** The first few of the skills those train, for their icons. */
  readonly skills: readonly SkillKey[]
  /** How many more skills there are than icons shown. */
  readonly moreSkills: number
}

/** A row has room for this many skill icons beside the quest's name. */
const MOST_SKILL_ICONS = 4

/** The quests that unlock something, in the order given, each with what it opens for this account. */
export function unlockRows(account: Account, quests: readonly string[]): UnlockRow[] {
  return quests.map((name) => {
    const gated = gatedActivities(account, { kind: 'quest', name })
    return {
      name,
      done: hasCompletedQuest(account, name),
      opens: listInWords(gated.names, 2),
      skills: gated.skills.slice(0, MOST_SKILL_ICONS),
      moreSkills: Math.max(0, gated.skills.length - MOST_SKILL_ICONS),
    }
  })
}

/** A quest that unlocks nothing, ticked for its XP reward. */
export interface QuestRow {
  readonly name: string
  readonly done: boolean
  /** Everything it pays, short: '140k'. */
  readonly xp: string
}

/** The quests in the order given, each with whether it is done and what it pays. */
export function questRows(account: Account, quests: readonly Quest[]): QuestRow[] {
  return quests.map((quest) => ({
    name: quest.name,
    done: hasCompletedQuest(account, quest.name),
    xp: formatShortNumber(questTotalXp(quest)),
  }))
}

/** Which of a list's quests to show. */
export type QuestFilter = 'all' | 'not-done' | 'done'

/** The choices of the filter, as their chips say them. */
export const QUEST_FILTER_OPTIONS: readonly {
  readonly value: QuestFilter
  readonly label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'not-done', label: 'Not done' },
  { value: 'done', label: 'Done' },
]

/** The rows whose name holds the search text, whatever its capitals, and that pass the filter. */
export function filterQuestRows<Row extends { readonly name: string; readonly done: boolean }>(
  rows: readonly Row[],
  search: string,
  filter: QuestFilter,
): Row[] {
  const sought = search.trim().toLowerCase()
  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(sought) &&
      (filter === 'all' || row.done === (filter === 'done')),
  )
}

/** How many of a list are done, as its heading's aside says: '22 of 39 ticked'. */
export function tickedCountLabel(rows: readonly { readonly done: boolean }[]): string {
  return `${rows.filter((row) => row.done).length} of ${rows.length} ticked`
}

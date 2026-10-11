import type { Account } from '../types/account'
import type { Intensity, Method } from '../types/method'
import type { Quest } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { METHODS } from '../data/methods'
import { QUESTS } from '../data/quests'
import { RESETS } from '../data/resets'
import { SKILL_KEYS } from '../data/skills'
import { WILDCARDS } from '../data/wildcards'
import { hasCompletedDiary, hasCompletedQuest, isIronman } from './account'
import { hoursLeft } from './estimates'
import { methodOptions, suitsTickPreference } from './methods'
import { activityOf, isInPlay, methodForBlock } from './planner'
import { questPrerequisites, questsRuledOut } from './quest-chains'
import type { QuestTicks } from './quest-ticks'
import { gatingDiaries, gatingQuests, questLevelsShort } from './quests'
import { xpPerHourAt } from './rates'
import { resetAppliesTo, unlockedResets } from './resets'

/*
 * Which quests and diary tiers are worth asking a player about. The hiscores say nothing about
 * either, and most of them change nothing the planner does, so the app asks only about the ones
 * that would change this account's plan, the biggest first, and stops when none is left.
 */

/** A quest or a diary tier ('Ardougne Medium') that something in the data requires. */
export interface PlanRequirement {
  readonly kind: 'quest' | 'diary'
  readonly name: string
}

/** A training method a requirement would open, as the activity a player would name. */
export interface OpenedMethod {
  /** The activity, whatever style it is done in: 'Gemstone Crab'. */
  readonly name: string
  /** The skills it trains, in hiscores order. */
  readonly skills: readonly SkillKey[]
}

/** What would change for an account if it had one more requirement done. */
export interface RequirementEffect {
  /** Hours to max that would come off. Never negative; 0 when no faster method opens. */
  readonly hoursSaved: number
  /** The skills in which an AFK, a semi-AFK or an active block would be dealt a different method. */
  readonly skillsChanged: readonly SkillKey[]
  /** The timed runs and dailies that would become available, by name, in the data's order. */
  readonly resetsOpened: readonly string[]
  /**
   * The methods it is the last thing in the way of: the fastest first, each activity once
   * whatever style it is done in, with the skills it trains.
   */
  readonly methodsOpened: readonly OpenedMethod[]
  /** What it opens up, by name: `methodsOpened`, then `resetsOpened`. */
  readonly opens: readonly string[]
}

/** One question: whether a requirement is done, and what a yes would change. */
export interface PlanQuestion extends RequirementEffect {
  readonly requirement: PlanRequirement
}

/**
 * The questions to put to an account, in two rounds, each in the order to ask it. The first
 * round is what makes the hours to max right; the second is worth asking but can wait.
 */
export interface PlanQuestions {
  /** The questions whose yes would take hours off the hours to max (`savesHours`). */
  readonly savingHours: readonly PlanQuestion[]
  /**
   * The smaller questions: a yes saves no hours to speak of, but adds a timed run or a daily to
   * the account's sessions, or another method a block could be dealt.
   */
  readonly smaller: readonly PlanQuestion[]
  /**
   * How many other open requirements are not asked about, because a yes would change nothing
   * yet. They are looked at again each time, so one can become a question later.
   */
  readonly setAsideCount: number
}

/** The "not yet" answers a player has given. */
export type DeclinedAnswers = Pick<QuestTicks, 'declinedQuests' | 'declinedDiaries'>

/** A saving smaller than this is not worth a question: half an hour on a grind of thousands. */
export const SMALLEST_SAVING_IN_HOURS = 0.5

/** The three kinds of block a session deals. */
const BLOCK_KINDS: readonly (readonly Intensity[])[] = [['afk'], ['semi'], ['active']]

// which requirements gate something is a fact of the data, the same for every account
const GATING_REQUIREMENTS: readonly PlanRequirement[] = [
  ...gatingQuests().map((name) => ({ kind: 'quest', name }) as const),
  ...gatingDiaries().map((name) => ({ kind: 'diary', name }) as const),
]

const QUESTS_BY_NAME: ReadonlyMap<string, Quest> = new Map(
  QUESTS.map((quest) => [quest.name, quest]),
)

/** Does this method, reset or wildcard name the requirement? */
function names(
  gated: { readonly requirements: Method['requirements'] },
  requirement: PlanRequirement,
): boolean {
  const { quests, diaries } = gated.requirements
  return (requirement.kind === 'quest' ? quests : diaries).includes(requirement.name)
}

/** The account with one more requirement done. A quest brings every quest it requires with it. */
export function withRequirementDone(account: Account, requirement: PlanRequirement): Account {
  if (requirement.kind === 'diary') {
    return {
      ...account,
      completedDiaries: new Set([...account.completedDiaries, requirement.name]),
    }
  }
  return {
    ...account,
    completedQuests: new Set([
      ...account.completedQuests,
      requirement.name,
      ...questPrerequisites(requirement.name),
    ]),
  }
}

/** The quests a yes would newly settle: the quest itself and whatever it requires that is not done. */
function questsSettledBy(account: Account, quest: string): string[] {
  return [quest, ...questPrerequisites(quest)].filter((link) => !hasCompletedQuest(account, link))
}

/** The skills with a method that names any of these requirements, in hiscores order. */
function skillsGatedBy(requirements: readonly PlanRequirement[]): SkillKey[] {
  return SKILL_KEYS.filter((skill) =>
    METHODS[skill].some((method) => requirements.some((requirement) => names(method, requirement))),
  )
}

/**
 * Could the account have finished this quest? Not if its levels are below what the quest, or
 * any quest on the way to it, needs. A quest the data lists no levels for always could.
 */
function couldHaveFinished(account: Account, quest: string): boolean {
  return [quest, ...questPrerequisites(quest)].every((link) => {
    const known = QUESTS_BY_NAME.get(link)
    return !known || questLevelsShort(account, known).length === 0
  })
}

/** The methods of these skills that go from missing something to missing nothing, the fastest first. */
function methodsOpened(account: Account, after: Account, skills: readonly SkillKey[]): Method[] {
  const opened: { readonly method: Method; readonly xpPerHour: number }[] = []
  for (const skill of skills) {
    const level = account.skills[skill].level
    const optionsAfter = methodOptions(after, skill)
    methodOptions(account, skill).forEach(({ method, missing }, place) => {
      // the account's type decides which methods are listed, so the two lists line up
      const stillMissing = optionsAfter[place]?.missing.length ?? 0
      if (!missing.length || stillMissing || !suitsTickPreference(account, method)) return
      // rated at the level it can first be used: its own, or the account's if that is higher
      const xpPerHour = xpPerHourAt(method, Math.max(level, method.level), account)
      opened.push({ method, xpPerHour })
    })
  }
  return opened
    .sort(
      (first, second) =>
        second.xpPerHour - first.xpPerHour || compareNames(first.method.name, second.method.name),
    )
    .map(({ method }) => method)
}

/**
 * Methods as the activities a player would name, each once and in the order given, with the
 * skills each trains. The style a method is done in is dropped the way the planner's
 * `activityOf` drops it, and so is a method whose name only adds words to another's: with
 * 'Hallowed Sepulchre' on the list, 'Hallowed Sepulchre looting coffins' is the same place said
 * twice. Its skills are counted under the shorter name.
 */
function distinctActivities(methods: readonly Method[]): OpenedMethod[] {
  const skillsOf = new Map<string, Set<SkillKey>>()
  for (const method of methods) {
    const activity = activityOf(method.name)
    const skills = skillsOf.get(activity) ?? new Set()
    skillsOf.set(activity, skills.add(method.skill))
  }
  const activities = [...skillsOf.keys()]
  const kept: OpenedMethod[] = []
  for (const activity of activities) {
    if (activities.some((other) => activity.startsWith(`${other} `))) continue
    const trained = new Set<SkillKey>()
    for (const [name, skills] of skillsOf) {
      if (name === activity || name.startsWith(`${activity} `)) {
        for (const skill of skills) trained.add(skill)
      }
    }
    kept.push({ name: activity, skills: SKILL_KEYS.filter((skill) => trained.has(skill)) })
  }
  return kept
}

/** Plain code-point order, not a locale's: the order must come out the same on every machine. */
function compareNames(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0
}

/**
 * What would change if the account had this requirement done, everything else staying as it is?
 * Hours come from the estimates and block choices from the planner's own `methodForBlock`, so
 * this can never disagree with what the rest of the app shows. `hoursNow` is the account's
 * hours left in a skill: passed in so that a run over many requirements works each out once.
 */
function requirementEffect(
  account: Account,
  requirement: PlanRequirement,
  hoursNow: (skill: SkillKey) => number,
): RequirementEffect {
  const after = withRequirementDone(account, requirement)
  const settled: readonly PlanRequirement[] =
    requirement.kind === 'quest'
      ? questsSettledBy(account, requirement.name).map((name) => ({ kind: 'quest', name }))
      : [requirement]
  // a requirement can only change the skills that have a method behind it
  const skills = skillsGatedBy(settled)

  let hoursSaved = 0
  const skillsChanged: SkillKey[] = []
  for (const skill of skills) {
    hoursSaved += hoursNow(skill) - hoursLeft(after, skill)
    const blockChanges =
      isInPlay(account, skill) &&
      BLOCK_KINDS.some(
        (intensities) =>
          methodForBlock(account, skill, intensities)?.method !==
          methodForBlock(after, skill, intensities)?.method,
      )
    if (blockChanges) skillsChanged.push(skill)
  }

  const openNow = new Set(unlockedResets(account))
  const resetsOpened = unlockedResets(after)
    .filter((reset) => !openNow.has(reset))
    .map((reset) => reset.name)
  const opened = distinctActivities(methodsOpened(account, after, skills))

  return {
    hoursSaved,
    skillsChanged,
    resetsOpened,
    methodsOpened: opened,
    opens: [...new Set([...opened.map((method) => method.name), ...resetsOpened])],
  }
}

/** Would a yes take at least half an hour off the hours to max? */
export function savesHours(effect: RequirementEffect): boolean {
  return effect.hoursSaved >= SMALLEST_SAVING_IN_HOURS
}

/**
 * Would a yes change the plan? It would if it took at least half an hour off the hours to max,
 * changed the method some skill's block would be dealt, or opened a timed run or a daily.
 */
export function changesThePlan(effect: RequirementEffect): boolean {
  return savesHours(effect) || effect.skillsChanged.length > 0 || effect.resetsOpened.length > 0
}

/** How many block choices and resets a yes would change: what orders questions that save the same hours. */
function planChanges(effect: RequirementEffect): number {
  return effect.skillsChanged.length + effect.resetsOpened.length
}

/**
 * Puts a quest that carries another's saving in front of it. A quest's saving counts what the
 * quests it requires unlock, so several quests can each seem to save what is one early quest's
 * doing (Druidic Ritual, behind a dozen others). Asked in plain order of saving, a player who
 * has the early quest but none of the later ones would say "not yet" all the way down to it.
 *
 * So a quest is never asked before a quest it requires, however far back, whose own saving is at
 * least half of its saving: that one moves to just before it, and whatever carries its saving
 * moves in front of that in turn. Otherwise the order given is kept. Diary tiers have no chains
 * and stay where they are, and a question that saves no hours neither moves nor moves another.
 */
export function askCarriersFirst(
  questions: readonly PlanQuestion[],
  prerequisitesOf: (quest: string) => readonly string[] = questPrerequisites,
): PlanQuestion[] {
  const ordered: PlanQuestion[] = []
  const placed = new Set<PlanQuestion>()
  const place = (question: PlanQuestion): void => {
    if (placed.has(question)) return
    // marked before its carriers are placed, so nothing can come round to it again
    placed.add(question)
    if (question.requirement.kind === 'quest' && savesHours(question)) {
      const required = prerequisitesOf(question.requirement.name)
      for (const other of questions) {
        const carries =
          other.requirement.kind === 'quest' &&
          savesHours(other) &&
          required.includes(other.requirement.name) &&
          other.hoursSaved >= question.hoursSaved / 2
        if (carries) place(other)
      }
    }
    ordered.push(question)
  }
  for (const question of questions) place(question)
  return ordered
}

/**
 * The questions worth asking this account now, in two rounds: the ones that save hours, then the
 * smaller ones. Within a round the biggest saving of hours comes first; questions that save the
 * same (most often none) are ordered by how much of the plan they change, then by name. Among
 * the ones that save hours, a quest that carries another's saving is then moved in front of it
 * (`askCarriersFirst`).
 *
 * A requirement is a candidate when a method, a reset or a wildcard requires it and the account
 * has neither done it nor said "not yet". A quest is left out when the account cannot have
 * finished it: its levels are short of the quest's own, or a quest it requires was declined.
 * A candidate becomes a question when `isWorthAsking` says a yes would change something.
 *
 * Each effect is worked out with everything else as it stands, so one answer changes what the
 * others are worth: ask the first question, take the answer in, and call this again.
 */
export function planQuestions(
  account: Account,
  declined: DeclinedAnswers,
  isWorthAsking: (effect: RequirementEffect) => boolean = changesThePlan,
): PlanQuestions {
  const ruledOut = questsRuledOut(declined.declinedQuests)
  const candidates = GATING_REQUIREMENTS.filter(({ kind, name }) =>
    kind === 'diary'
      ? !hasCompletedDiary(account, name) && !declined.declinedDiaries.includes(name)
      : !hasCompletedQuest(account, name) &&
        !declined.declinedQuests.includes(name) &&
        !ruledOut.has(name),
  )

  const hoursKnown = new Map<SkillKey, number>()
  const hoursNow = (skill: SkillKey): number => {
    let hours = hoursKnown.get(skill)
    if (hours === undefined) {
      hours = hoursLeft(account, skill)
      hoursKnown.set(skill, hours)
    }
    return hours
  }

  const questions: PlanQuestion[] = []
  for (const requirement of candidates) {
    if (requirement.kind === 'quest' && !couldHaveFinished(account, requirement.name)) continue
    const effect = requirementEffect(account, requirement, hoursNow)
    if (isWorthAsking(effect)) questions.push({ requirement, ...effect })
  }
  questions.sort(
    (first, second) =>
      second.hoursSaved - first.hoursSaved ||
      planChanges(second) - planChanges(first) ||
      compareNames(first.requirement.name, second.requirement.name),
  )
  return {
    savingHours: askCarriersFirst(questions.filter(savesHours)),
    smaller: questions.filter((question) => !savesHours(question)),
    setAsideCount: candidates.length - questions.length,
  }
}

/** What a requirement stands in front of, whatever the account has done. */
export interface GatedActivities {
  /** Methods (each activity once), then resets, then wildcards, by name, in the data's order. */
  readonly names: readonly string[]
  /** The skills those methods and resets train, in hiscores order. */
  readonly skills: readonly SkillKey[]
}

/**
 * Everything that names this requirement and is for this kind of account: what a tick list
 * shows beside a quest. Unlike a question's `opens` it does not look at what else the account
 * has done, so it reads the same before and after the quest is ticked.
 */
export function gatedActivities(account: Account, requirement: PlanRequirement): GatedActivities {
  const ironman = isIronman(account)
  const methods = SKILL_KEYS.flatMap((skill) => METHODS[skill]).filter(
    (method) =>
      names(method, requirement) &&
      (method.audience === 'both' || (method.audience === 'iron') === ironman),
  )
  const resets = RESETS.filter(
    (reset) => names(reset, requirement) && resetAppliesTo(reset, account),
  )
  const wildcards = WILDCARDS.filter((wildcard) => names(wildcard, requirement))
  const trained = new Set<SkillKey>(methods.map((method) => method.skill))
  for (const reset of resets) if (reset.skill) trained.add(reset.skill)
  return {
    names: [
      ...new Set([
        ...distinctActivities(methods).map((method) => method.name),
        ...resets.map((reset) => reset.name),
        ...wildcards.map((wildcard) => wildcard.name),
      ]),
    ],
    skills: SKILL_KEYS.filter((skill) => trained.has(skill)),
  }
}

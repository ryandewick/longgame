import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { XpSnapshot } from '#shared/types/snapshot'
import { SKILL_KEYS } from '#shared/data/skills'
import { hoursLeft, maxProgress } from '#shared/domain/estimates'
import { fastestMethod, methodOptions } from '#shared/domain/methods'
import { questStepFor } from '#shared/domain/quest-step'
import { closeTicks } from '#shared/domain/quest-ticks'
import {
  accountFromSave,
  blankSave,
  migrateLegacySnapshots,
  readSave,
  type LegacySnapshot,
  type SavedState,
} from '#shared/domain/save'
import { useSavedState } from '~~/app/composables/useSavedState'
import { useAccountStore } from '~~/app/stores/account'
import { useHistoryStore } from '~~/app/stores/history'
import { useSessionStore } from '~~/app/stores/session'

/** The fixture account: a version 1 save, its snapshots and the moment it was taken. */
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
) as { now: number; state: unknown; snapshots: LegacySnapshot[] }

function fixtureSave(): SavedState {
  const save = readSave(fixture.state)
  if (!save) throw new Error('tests/fixtures/account.json is not a save')
  return save
}

/** The fixture's save with everything its ticks prove written in, as the stores keep it. */
function closedFixtureSave(): SavedState {
  const save = fixtureSave()
  return { ...save, ...closeTicks(save) }
}

const fixtureSnapshots = (): XpSnapshot[] => migrateLegacySnapshots(fixture.snapshots)

/** The three stores with the fixture account loaded. */
function loadedStores() {
  const { savedState, restore } = useSavedState()
  restore(fixtureSave())
  const history = useHistoryStore()
  history.setSnapshots(fixtureSnapshots())
  return { account: useAccountStore(), session: useSessionStore(), history, savedState, restore }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(fixture.now)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the save', () => {
  it('is blank before anything is loaded', () => {
    expect(useSavedState().savedState.value).toEqual(blankSave())
  })

  it('comes back out of the stores as it went in, with what its ticks prove written in', () => {
    const { savedState, restore } = loadedStores()
    expect(savedState.value).toEqual(closedFixtureSave())
    // the fixture was saved before the app knew Rune Mysteries (acceptance C2), and before a
    // claimed tier said anything about its quests: Ardougne Medium needs Fairytale II started (C5)
    expect(savedState.value.completedQuests).toContain('Rune Mysteries')
    expect(savedState.value.startedQuests).toContain('Fairytale II - Cure a Queen')
    // a save with all of that written in already comes back exactly as it went in
    setActivePinia(createPinia())
    restore(closedFixtureSave())
    expect(useSavedState().savedState.value).toEqual(closedFixtureSave())
  })

  it('survives a trip through JSON, which is how it is stored', () => {
    const { savedState, restore } = loadedStores()
    const stored: unknown = JSON.parse(JSON.stringify(savedState.value))
    setActivePinia(createPinia())
    const again = readSave(stored)
    expect(again).not.toBeNull()
    if (again) restore(again)
    expect(useSavedState().savedState.value).toEqual(closedFixtureSave())
  })
})

describe('the account store', () => {
  it('has no account until there is a name and stats', () => {
    const account = useAccountStore()
    expect(account.hasAccount).toBe(false)
    account.setName('Zezima')
    expect(account.hasAccount).toBe(false)
    account.applyHiscores(fixtureSave().hiscores ?? raise('the fixture has no hiscores'))
    expect(account.hasAccount).toBe(true)
  })

  it('gives the rules the account the save describes', () => {
    const { account } = loadedStores()
    expect(account.account).toEqual(accountFromSave(fixtureSave()))
    expect(account.isIronman).toBe(account.account.type === 'iron')
  })

  it("answers for every skill with the domain's own figures", () => {
    const { account } = loadedStores()
    const rules = accountFromSave(fixtureSave())
    for (const skill of SKILL_KEYS) {
      const insight = account.skillInsights[skill]
      expect(insight.skill).toBe(skill)
      expect(insight.stat).toEqual(rules.skills[skill])
      expect(insight.methods).toEqual(methodOptions(rules, skill))
      expect(insight.hoursLeft).toBe(hoursLeft(rules, skill))
      expect(insight.fastestMethod).toEqual(fastestMethod(rules, skill))
    }
    expect(account.maxProgress).toEqual(maxProgress(rules))
    expect(account.hasRoughEstimate).toBe(
      SKILL_KEYS.some((skill) => account.skillInsights[skill].isRough),
    )
  })

  it('hangs the rack lowest level first', () => {
    const { account } = loadedStores()
    const levels = account.rackOrder.map((skill) => account.account.skills[skill].level)
    expect(levels).toEqual([...levels].sort((first, second) => first - second))
    expect(account.rackOrder).toHaveLength(SKILL_KEYS.length)
  })

  it('does not work the estimates out again when an unrelated preference changes', () => {
    const { account } = loadedStores()
    const before = account.skillInsights
    account.setPreference('mood', 'afk')
    account.setPreference('minutes', 180)
    account.setPreference('skillSort', 'name')
    expect(account.skillInsights).toBe(before)
    account.setPreference('tickPerfect', !account.preferences.tickPerfect)
    expect(account.skillInsights).not.toBe(before)
  })

  it('ticks what a quest-progress add-on reports, keeping every tick already there', () => {
    const account = useAccountStore()
    account.stepQuest('Plague City')
    account.toggleDiary('Karamja Easy')
    account.recordProgress({
      quests: ["Cook's Assistant", 'Plague City', "Cook's Assistant"],
      started: ['The Giant Dwarf'],
      // the Kourend & Kebos Easy diary needs Druidic Ritual, which comes with it
      diaries: ['Kourend & Kebos Easy'],
    })
    expect(account.completedQuests).toEqual(['Plague City', "Cook's Assistant", 'Druidic Ritual'])
    expect(account.startedQuests).toEqual(['The Giant Dwarf'])
    expect(account.completedDiaries).toEqual(['Karamja Easy', 'Kourend & Kebos Easy'])
    expect(account.account.completedQuests.has("Cook's Assistant")).toBe(true)
  })

  it('leaves the ticks untouched when a report holds nothing new', () => {
    const account = useAccountStore()
    account.stepQuest('Plague City')
    const { completedQuests, startedQuests, completedDiaries } = account
    account.recordProgress({ quests: ['Plague City'], diaries: [] })
    // the same lists, so nothing is saved again
    expect(account.completedQuests).toBe(completedQuests)
    expect(account.startedQuests).toBe(startedQuests)
    expect(account.completedDiaries).toBe(completedDiaries)
  })

  it('ticks and unticks quests and diaries', () => {
    const account = useAccountStore()
    account.stepQuest("Cook's Assistant")
    account.toggleDiary('Karamja Easy')
    expect(account.account.completedQuests.has("Cook's Assistant")).toBe(true)
    expect(account.account.completedDiaries.has('Karamja Easy')).toBe(true)
    account.stepQuest("Cook's Assistant")
    account.toggleDiary('Karamja Easy')
    expect(account.completedQuests).toEqual([])
    expect(account.completedDiaries).toEqual([])
  })

  it('steps a quest whose start matters through started, done and back to not done', () => {
    const account = useAccountStore()
    expect(account.stepQuest('Dragon Slayer I')).toMatchObject({ from: 'not-done', to: 'started' })
    expect(account.startedQuests).toEqual(['Dragon Slayer I'])
    expect(account.stepQuest('Dragon Slayer I')).toMatchObject({ from: 'started', to: 'done' })
    expect(account.completedQuests).toEqual(['Dragon Slayer I'])
    expect(account.startedQuests).toEqual([])
    expect(account.stepQuest('Dragon Slayer I')).toMatchObject({ from: 'done', to: 'not-done' })
    expect(account.completedQuests).toEqual([])
    expect(account.startedQuests).toEqual([])
  })

  it('takes a quest back only to started while a claimed tier needs it started, and says which', () => {
    const account = useAccountStore()
    // the Kandarin Easy diary needs Elemental Workshop I started
    expect(account.toggleDiary('Kandarin Easy')).toMatchObject({
      ticked: true,
      alsoStarted: ['Elemental Workshop I'],
    })
    expect(account.questState('Elemental Workshop I')).toBe('started')
    account.stepQuest('Elemental Workshop I')
    expect(account.stepQuest('Elemental Workshop I')).toMatchObject({
      from: 'done',
      to: 'started',
      heldStartedBy: ['Kandarin Easy'],
    })
  })

  it('ticks the tiers below a tier with it, and unticks the ones above', () => {
    const account = useAccountStore()
    expect(account.toggleDiary('Wilderness Medium')).toMatchObject({
      ticked: true,
      diariesChanged: ['Wilderness Easy'],
      alsoChanged: ['Enter the Abyss', 'Rune Mysteries'],
    })
    expect(account.toggleDiary('Wilderness Easy')).toMatchObject({
      ticked: false,
      diariesChanged: ['Wilderness Medium'],
    })
    expect(account.completedDiaries).toEqual([])
  })

  it('ticks the quests a quest requires with it, and says which', () => {
    const account = useAccountStore()
    expect(account.stepQuest('Underground Pass')).toEqual({
      from: 'not-done',
      to: 'done',
      alsoChanged: ['Biohazard', 'Plague City'],
      alsoStarted: [],
      diariesChanged: [],
      heldStartedBy: [],
    })
    expect(account.completedQuests).toEqual(['Underground Pass', 'Biohazard', 'Plague City'])
    expect(account.account.completedQuests.has('Plague City')).toBe(true)
  })

  it('unticks the quests that require a quest with it, and says which', () => {
    const account = useAccountStore()
    account.stepQuest('Underground Pass')
    expect(account.stepQuest('Plague City')).toEqual({
      from: 'done',
      to: 'not-done',
      alsoChanged: ['Biohazard', 'Underground Pass'],
      alsoStarted: [],
      diariesChanged: [],
      heldStartedBy: [],
    })
    expect(account.completedQuests).toEqual([])
    expect(account.declinedQuests).toEqual([])
  })

  it('takes a "done" answer in as a tick and a "not yet" as something not to ask again', () => {
    const account = useAccountStore()
    expect(account.answerQuestion({ kind: 'quest', name: 'Biohazard' }, true)).toEqual([
      'Plague City',
    ])
    expect(account.answerQuestion({ kind: 'quest', name: 'Bone Voyage' }, false)).toEqual([])
    expect(account.answerQuestion({ kind: 'diary', name: 'Desert Hard' }, false)).toEqual([])
    expect(account.answerQuestion({ kind: 'diary', name: 'Kandarin Easy' }, true)).toEqual([])

    expect(account.completedQuests).toEqual(['Biohazard', 'Plague City'])
    expect(account.completedDiaries).toEqual(['Kandarin Easy'])
    expect(account.declinedQuests).toEqual(['Bone Voyage'])
    expect(account.declinedDiaries).toEqual(['Desert Hard'])
    expect(useSavedState().savedState.value).toMatchObject({
      declinedQuests: ['Bone Voyage'],
      declinedDiaries: ['Desert Hard'],
    })
  })

  it('forgets a "not yet" when the quest or the tier is ticked later, wherever that happens', () => {
    const account = useAccountStore()
    account.answerQuestion({ kind: 'quest', name: 'Plague City' }, false)
    account.answerQuestion({ kind: 'quest', name: 'Bone Voyage' }, false)
    account.answerQuestion({ kind: 'diary', name: 'Desert Hard' }, false)

    // ticking a quest that requires it settles Plague City too
    account.stepQuest('Biohazard')
    account.toggleDiary('Desert Hard')
    expect(account.declinedQuests).toEqual(['Bone Voyage'])
    expect(account.declinedDiaries).toEqual([])

    account.recordProgress({ quests: ['Bone Voyage'], diaries: [] })
    expect(account.declinedQuests).toEqual([])
  })

  it('asks the questions the rules say are worth asking, and fewer after each answer', () => {
    const { account } = loadedStores()
    const before = account.planQuestions
    const [first] = before.savingHours
    // the Desert Hard diary saves the most, and most of that is Dream Mentor's, which is mostly
    // Lunar Diplomacy's (Dream Mentor requires it), so Lunar Diplomacy is asked first
    expect(first?.requirement).toEqual({ kind: 'quest', name: 'Lunar Diplomacy' })
    if (!first) return

    account.answerQuestion(first.requirement, false)
    const after = account.planQuestions
    expect(after.savingHours.map((question) => question.requirement.name)).not.toContain(
      'Lunar Diplomacy',
    )
    expect(after.savingHours.length).toBeLessThan(before.savingHours.length)
    // the smaller questions are a round of their own, and this answer was not one of them
    expect(after.smaller.length).toBeGreaterThan(0)
    expect(after.smaller).toEqual(before.smaller)
    // an answer changes no hours unless it is a yes
    expect(account.maxProgress.hoursLeft).toBe(maxProgress(account.account).hoursLeft)
  })

  it('takes the hours a yes saves off the hours to max, to the figure the question gave', () => {
    const { account } = loadedStores()
    const [first] = account.planQuestions.savingHours
    if (!first) throw new Error('the fixture account has nothing to ask')
    const hoursBefore = account.maxProgress.hoursLeft

    account.answerQuestion(first.requirement, true)
    expect(hoursBefore - account.maxProgress.hoursLeft).toBeCloseTo(first.hoursSaved, 6)
  })

  it('has the two all-done shortcuts', () => {
    const account = useAccountStore()
    account.setAllQuests(true)
    account.setAllDiaries(true)
    expect(account.account.allQuests).toBe(true)
    expect(account.account.allDiaries).toBe(true)
    account.setAllQuests(false)
    expect(account.account.allQuests).toBe(false)
  })

  it('keeps a skill out of deals, once, and lets it back in', () => {
    const account = useAccountStore()
    account.setSkillExcluded('agility', true)
    account.setSkillExcluded('agility', true)
    expect(account.preferences.excludedSkills).toEqual(['agility'])
    expect(account.account.preferences.excludedSkills.has('agility')).toBe(true)
    account.setSkillExcluded('agility', false)
    expect(account.preferences.excludedSkills).toEqual([])
  })

  it('logs a reset as done now', () => {
    const account = useAccountStore()
    account.markResetDone('herb')
    expect(account.resetLog).toEqual({ herb: fixture.now })
  })

  it('starts a new account when the name changes, keeping ticks and preferences', () => {
    const { account, session, history } = loadedStores()
    account.stepQuest('Dragon Slayer I')
    account.setPreference('mood', 'afk')
    session.deal()
    const quests = account.completedQuests

    expect(account.setName('  Someone Else ')).toBe(true)

    expect(account.name).toBe('Someone Else')
    expect(account.hiscores).toBeNull()
    expect(account.accountType).toBeNull()
    expect(session.session).toBeNull()
    expect(session.recentSkills).toEqual([])
    expect(history.entries).toEqual([])
    expect(history.snapshots).toEqual([])
    expect(account.completedQuests).toBe(quests)
    expect(account.preferences.mood).toBe('afk')
  })

  it('changes nothing when the name is the one it has', () => {
    const { account, history } = loadedStores()
    expect(account.setName(` ${account.name} `)).toBe(false)
    expect(account.hiscores).not.toBeNull()
    expect(history.snapshots).toHaveLength(fixture.snapshots.length)
  })

  it('forgets everything', () => {
    const { account, session, savedState } = loadedStores()
    session.deal()
    account.forget()
    expect(savedState.value).toEqual(blankSave())
    expect(useHistoryStore().snapshots).toEqual([])
  })
})

describe('the session store', () => {
  it('has nothing live before a deal', () => {
    const { session } = loadedStores()
    expect(session.session).toBeNull()
    expect(session.liveBlockIndex).toBeNull()
    expect(session.liveSkill).toBeNull()
    expect(session.isFinished).toBe(false)
  })

  it('deals a session of the length asked for and remembers the skills it dealt', () => {
    const { account, session } = loadedStores()
    account.setPreference('minutes', 120)
    session.deal()
    expect(session.session?.minutes).toBe(120)
    expect(session.session?.startedAt).toBe(fixture.now)
    expect(session.session?.blocks.length).toBeGreaterThan(0)
    const dealtSkills = session.session?.blocks.flatMap((block) =>
      block.kind === 'skill' ? [block.skill] : [],
    )
    expect(session.recentSkills.slice(-(dealtSkills?.length ?? 0))).toEqual(dealtSkills)
    expect(session.liveBlockIndex).toBe(0)
  })

  it('times one block at a time, and the running block is the live one', () => {
    const { session } = loadedStores()
    session.deal()
    session.toggleBlock(1)
    expect(session.liveBlockIndex).toBe(1)
    vi.advanceTimersByTime(60_000)
    session.toggleBlock(0)
    expect(session.session?.blocks[1]?.runningSince).toBeNull()
    expect(session.session?.blocks[1]?.elapsed).toBe(60_000)
    expect(session.liveBlockIndex).toBe(0)
  })

  it('moves on to the next block when one is done, and logs a finished reset', () => {
    const { account, session } = loadedStores()
    account.setPreference('includeResets', true)
    session.deal()
    const first = session.session?.blocks[0]
    session.completeBlock(0)
    expect(session.session?.blocks[0]?.done).toBe(true)
    expect(session.liveBlockIndex).toBe(1)
    if (first?.kind === 'reset') expect(account.resetLog[first.resetKey]).toBe(fixture.now)
  })

  it('swaps a skill block for another skill, and says when it cannot', () => {
    const { account, session } = loadedStores()
    account.setPreference('includeResets', false)
    account.setPreference('includeWildcard', false)
    session.deal()
    const before = session.session?.blocks[0]
    expect(session.swapBlock(0)).toBe(true)
    const after = session.session?.blocks[0]
    expect(after?.kind).toBe('skill')
    expect(after).not.toEqual(before)
    // there is no block 99 to swap
    expect(session.swapBlock(99)).toBe(false)
  })

  it('finishes: stops the clocks, tallies the gains and files the session in the history', () => {
    const { account, session, history } = loadedStores()
    const sessionsBefore = history.entries.length
    session.deal()
    session.toggleBlock(0)
    vi.advanceTimersByTime(10 * 60_000)
    session.pauseAll()
    expect(session.session?.blocks[0]?.elapsed).toBe(10 * 60_000)

    // the player logs out and the hiscores catch up: 5,000 more Mining XP
    const stats = account.hiscores ?? raise('the fixture has no hiscores')
    const mining = stats.skills.mining
    account.applyHiscores({
      ...stats,
      skills: { ...stats.skills, mining: { ...mining, xp: mining.xp + 5000 } },
    })
    const entry = session.finish()

    expect(entry?.gains).toEqual({ mining: 5000 })
    expect(entry?.totalXp).toBe(5000)
    expect(entry?.elapsed).toBe(10 * 60_000)
    expect(session.isFinished).toBe(true)
    expect(session.session?.tally).toEqual({ gains: { mining: 5000 }, totalXp: 5000, levels: {} })
    expect(session.liveBlockIndex).toBeNull()
    expect(history.entries).toHaveLength(sessionsBefore + 1)
    expect(history.entries[0]).toEqual(entry)
    // a finished session cannot be finished twice
    expect(session.finish()).toBeNull()
    expect(history.entries).toHaveLength(sessionsBefore + 1)
  })

  it('ends the deal on the quest step it is given while quest steps are on, which brings no cape forward', () => {
    const { account, session } = loadedStores()
    const step = questStepFor(account.account, 120, 'balanced') ?? raise('nothing to deal')
    account.setPreference('minutes', 120)
    account.setPreference('includeResets', false)
    session.deal(step)
    const blocks = session.session?.blocks ?? []
    expect(blocks.at(-1)).toMatchObject({ kind: 'quest', title: step.title, done: false })
    expect(blocks.some((block) => block.kind === 'wildcard')).toBe(false)

    // the step is live once every block before it is done: a quest has no skill cape to hang forward
    blocks.slice(0, -1).forEach((_, index) => session.completeBlock(index))
    expect(session.liveBlock?.kind).toBe('quest')
    expect(session.liveSkill).toBeNull()

    // switched off, the same step is not dealt
    account.setPreference('includeQuestStep', false)
    session.deal(step)
    expect(session.session?.blocks.some((block) => block.kind === 'quest')).toBe(false)
  })

  /** A two-hour deal without resets that ends on the test account's quest step, and the step's place. */
  function dealtWithStep() {
    const stores = loadedStores()
    const { account, session } = stores
    account.setPreference('minutes', 120)
    account.setPreference('includeResets', false)
    session.deal(questStepFor(account.account, 120, 'balanced'))
    const stepIndex = (session.session?.blocks.length ?? 0) - 1
    return { ...stores, stepIndex }
  }

  it('asks whether a step was finished: its clock stops, and it is the live block until answered', () => {
    const { session, stepIndex } = dealtWithStep()
    session.toggleBlock(0)
    vi.advanceTimersByTime(60_000)
    session.toggleBlock(stepIndex)
    vi.advanceTimersByTime(60_000)
    session.askStep(stepIndex)
    expect(session.askingIndex).toBe(stepIndex)
    expect(session.liveBlockIndex).toBe(stepIndex)
    expect(session.liveSkill).toBeNull()
    expect(session.session?.blocks[stepIndex]).toMatchObject({
      elapsed: 60_000,
      runningSince: null,
      done: false,
    })

    // a yes: the step is done, and comes back for the caller to tick
    expect(session.answerStep(true)).toMatchObject({ kind: 'quest', title: "Twilight's Promise" })
    expect(session.session?.blocks[stepIndex]?.done).toBe(true)
    expect(session.askingIndex).toBeNull()
    expect(session.liveBlockIndex).toBe(0)
  })

  it('leaves nothing to tick after a no, and puts the question off when another block starts', () => {
    const { session, stepIndex } = dealtWithStep()
    session.askStep(stepIndex)
    session.toggleBlock(0)
    expect(session.askingIndex).toBeNull()
    expect(session.liveBlockIndex).toBe(0)

    session.askStep(stepIndex)
    expect(session.answerStep(false)).toBeNull()
    expect(session.session?.blocks[stepIndex]?.done).toBe(true)
    // a step already done, or a block that is not a step, does not ask
    session.askStep(stepIndex)
    session.askStep(0)
    expect(session.askingIndex).toBeNull()
  })

  it('lists the skills that gained a level in the finished session', () => {
    const { session, restore } = loadedStores()
    session.deal()
    const dealt = session.session ?? raise('nothing was dealt')
    restore({
      ...fixtureSave(),
      session: {
        ...dealt,
        endedAt: fixture.now,
        tally: { gains: { ranged: 20_000, magic: 9000 }, totalXp: 29_000, levels: { ranged: 1 } },
      },
    })
    expect(session.levelledSkills).toEqual(['ranged'])
  })
})

describe('the history store', () => {
  it("reads pace, daily gains and the streak from the domain's rules", () => {
    const { history } = loadedStores()
    const gains = history.dailyGains(14, fixture.now)
    expect(gains).toHaveLength(14)
    expect(gains.at(-1)?.day).toBe(history.dailyGains(1, fixture.now)[0]?.day)
    expect(history.pace(7, undefined, fixture.now).xpPerDay).toBeGreaterThan(0)
    expect(history.pace(7, 'mining', fixture.now).xpPerDay).toBeLessThanOrEqual(
      history.pace(7, undefined, fixture.now).xpPerDay,
    )
    expect(history.dayStreak(fixture.now)).toBeGreaterThanOrEqual(0)
  })

  it('takes the time to be now when it is not given', () => {
    const { history } = loadedStores()
    expect(history.dailyGains(14)).toEqual(history.dailyGains(14, fixture.now))
    expect(history.dayStreak()).toBe(history.dayStreak(fixture.now))
  })

  it('has no pace without snapshots', () => {
    const history = useHistoryStore()
    expect(history.pace(7)).toEqual({ xpPerDay: 0, days: 0 })
    expect(history.dayStreak()).toBe(0)
  })
})

function raise(message: string): never {
  throw new Error(message)
}

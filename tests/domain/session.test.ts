import { describe, expect, it } from 'vitest'
import type { HistoryEntry, QuestBlock, Session, SessionBlock } from '#shared/types/session'
import { forEverySkill } from '#shared/data/skills'
import {
  HISTORY_LIMIT,
  addToHistory,
  blockElapsed,
  completeBlock,
  finishSession,
  isStepSettled,
  pauseAllBlocks,
  settleSteps,
  tallyGains,
  toggleBlock,
} from '#shared/domain/session'
import { xpForLevel } from '#shared/domain/xp'
import { accountWith } from './helpers'

const NOW = 1_800_000_000_000
const timer = { elapsed: 0, runningSince: null, done: false }

const BLOCKS: SessionBlock[] = [
  {
    kind: 'reset',
    resetKey: 'herb',
    title: 'Herb run',
    note: '',
    minutes: 5,
    skill: 'farming',
    ...timer,
  },
  {
    kind: 'skill',
    skill: 'mining',
    title: 'Iron ore',
    note: '',
    minutes: 40,
    intensity: 'active',
    wanted: ['active'],
    xpPerHour: 30_000,
    rateIsEstimate: false,
    targetXp: 20_000,
    ...timer,
  },
  { kind: 'wildcard', title: 'Clue scroll', note: '', minutes: 15, ...timer },
]

const startingXp = forEverySkill(() => 0)

const SESSION: Session = {
  startedAt: NOW,
  minutes: 60,
  blocks: BLOCKS,
  startingXp,
  endedAt: null,
  tally: null,
}

const skillsAt = (xp: Partial<Record<keyof typeof startingXp, { level: number; xp: number }>>) => ({
  ...forEverySkill(() => ({ level: 1, xp: 0 })),
  ...xp,
})

describe('blockElapsed', () => {
  it('is the banked time while paused', () => {
    expect(blockElapsed({ elapsed: 5_000, runningSince: null, done: false }, NOW)).toBe(5_000)
  })

  it('adds the stretch that is still running', () => {
    const running = { elapsed: 5_000, runningSince: NOW - 2_000, done: false }
    expect(blockElapsed(running, NOW)).toBe(7_000)
  })
})

describe('toggleBlock', () => {
  it('starts a paused block', () => {
    const session = toggleBlock(SESSION, 1, NOW)
    expect(session.blocks[1]?.runningSince).toBe(NOW)
    expect(session.blocks[0]?.runningSince).toBeNull()
  })

  it('pauses a running block and banks its time', () => {
    const running = toggleBlock(SESSION, 1, NOW)
    const stopped = toggleBlock(running, 1, NOW + 90_000)
    expect(stopped.blocks[1]).toMatchObject({ elapsed: 90_000, runningSince: null })
  })

  it('pauses whichever block was running when another starts', () => {
    const first = toggleBlock(SESSION, 0, NOW)
    const second = toggleBlock(first, 1, NOW + 30_000)
    expect(second.blocks[0]).toMatchObject({ elapsed: 30_000, runningSince: null })
    expect(second.blocks[1]).toMatchObject({ elapsed: 0, runningSince: NOW + 30_000 })
  })

  it('adds up several stretches', () => {
    let session = toggleBlock(SESSION, 1, NOW)
    session = toggleBlock(session, 1, NOW + 10_000)
    session = toggleBlock(session, 1, NOW + 60_000)
    session = toggleBlock(session, 1, NOW + 65_000)
    expect(session.blocks[1]?.elapsed).toBe(15_000)
  })

  it('does not change the session it was given, or one with no such block', () => {
    toggleBlock(SESSION, 1, NOW)
    expect(SESSION.blocks[1]?.runningSince).toBeNull()
    expect(toggleBlock(SESSION, 9, NOW)).toBe(SESSION)
  })
})

describe('completeBlock', () => {
  it('marks the block done and stops its timer', () => {
    const running = toggleBlock(SESSION, 1, NOW)
    const { session, completedResetKey } = completeBlock(running, 1, NOW + 45_000)
    expect(session.blocks[1]).toMatchObject({ done: true, elapsed: 45_000, runningSince: null })
    expect(completedResetKey).toBeNull()
  })

  it('names the reset a reset block completes, so it can be logged as done', () => {
    expect(completeBlock(SESSION, 0, NOW).completedResetKey).toBe('herb')
    expect(completeBlock(SESSION, 2, NOW).completedResetKey).toBeNull()
  })

  it('leaves the other blocks as they were', () => {
    const running = toggleBlock(SESSION, 1, NOW)
    const { session } = completeBlock(running, 0, NOW + 45_000)
    expect(session.blocks[1]?.runningSince).toBe(NOW)
  })
})

describe('pauseAllBlocks', () => {
  it('stops every timer and banks the time', () => {
    const running = toggleBlock(SESSION, 2, NOW)
    const paused = pauseAllBlocks(running, NOW + 5_000)
    expect(paused.blocks.every((block) => block.runningSince === null)).toBe(true)
    expect(paused.blocks[2]?.elapsed).toBe(5_000)
  })
})

describe('tallyGains', () => {
  it('counts the XP gained in each skill and in total', () => {
    const tally = tallyGains(
      { ...startingXp, mining: 1_000, fishing: 500 },
      skillsAt({ mining: { level: 20, xp: 5_000 }, fishing: { level: 8, xp: 900 } }),
    )
    expect(tally.gains).toEqual({ mining: 4_000, fishing: 400 })
    expect(tally.totalXp).toBe(4_400)
  })

  it('leaves out skills that gained nothing', () => {
    const tally = tallyGains(
      { ...startingXp, mining: 1_000 },
      skillsAt({ mining: { level: 9, xp: 1_000 } }),
    )
    expect(tally).toEqual({ gains: {}, totalXp: 0, levels: {} })
  })

  it('counts levels gained from the level the starting XP was worth', () => {
    const tally = tallyGains(
      { ...startingXp, mining: xpForLevel(30), fishing: xpForLevel(40) },
      skillsAt({
        mining: { level: 33, xp: xpForLevel(33) + 10 },
        fishing: { level: 40, xp: xpForLevel(40) + 10 },
      }),
    )
    expect(tally.levels).toEqual({ mining: 3 })
  })
})

describe('finishSession', () => {
  const underway = toggleBlock(
    {
      ...SESSION,
      blocks: SESSION.blocks.map((block, index) =>
        index === 0 ? { ...block, elapsed: 120_000, done: true } : block,
      ),
    },
    1,
    NOW,
  )
  const after = skillsAt({ mining: { level: 25, xp: 8_000 } })
  const { session, entry } = finishSession(underway, after, NOW + 600_000)

  it('stops the timers, stamps the end and attaches the tally', () => {
    expect(session.endedAt).toBe(NOW + 600_000)
    expect(session.blocks.every((block) => block.runningSince === null)).toBe(true)
    expect(session.tally).toEqual({
      gains: { mining: 8_000 },
      totalXp: 8_000,
      levels: { mining: 24 },
    })
  })

  it('writes the history entry: the tally, the time spent and what each block came to', () => {
    expect(entry).toEqual({
      endedAt: NOW + 600_000,
      minutes: 60,
      elapsed: 120_000 + 600_000,
      gains: { mining: 8_000 },
      totalXp: 8_000,
      levels: { mining: 24 },
      blocks: [
        { kind: 'reset', resetKey: 'herb', title: 'Herb run', done: true },
        { kind: 'skill', skill: 'mining', title: 'Iron ore', done: false },
        { kind: 'wildcard', title: 'Clue scroll', done: false },
      ],
    })
  })

  it('remembers a quest or diary step by its name and what it was to do', () => {
    const step: SessionBlock = {
      kind: 'quest',
      title: 'Fairytale II - Cure a Queen',
      step: 'start',
      minutes: 30,
      reason: { kind: 'unlock', goal: 'Fairy rings', left: 1 },
      ...timer,
      done: true,
    }
    const finished = finishSession({ ...SESSION, blocks: [step] }, after, NOW)
    expect(finished.entry.blocks).toEqual([
      { kind: 'quest', step: 'start', title: 'Fairytale II - Cure a Queen', done: true },
    ])
  })
})

const questStep = (title: string, step: QuestBlock['step']): QuestBlock => ({
  kind: 'quest',
  title,
  step,
  minutes: 30,
  reason: { kind: 'unlock', goal: 'Fairy rings', left: 1 },
  ...timer,
})

describe('isStepSettled', () => {
  it('settles a quest to finish only once it is finished', () => {
    const step = questStep("Twilight's Promise", 'finish')
    expect(isStepSettled(step, accountWith())).toBe(false)
    expect(isStepSettled(step, accountWith({ started: ["Twilight's Promise"] }))).toBe(false)
    expect(isStepSettled(step, accountWith({ quests: ["Twilight's Promise"] }))).toBe(true)
    expect(isStepSettled(step, accountWith({ allQuests: true }))).toBe(true)
  })

  it('settles a quest to start once it is started or finished', () => {
    const step = questStep('Fairytale II - Cure a Queen', 'start')
    expect(isStepSettled(step, accountWith())).toBe(false)
    expect(isStepSettled(step, accountWith({ started: ['Fairytale II - Cure a Queen'] }))).toBe(
      true,
    )
    expect(isStepSettled(step, accountWith({ quests: ['Fairytale II - Cure a Queen'] }))).toBe(true)
  })

  it('settles a diary tier once it is claimed, and the quest cape does not', () => {
    const step = questStep('Ardougne Medium', 'claim')
    expect(isStepSettled(step, accountWith({ allQuests: true }))).toBe(false)
    expect(isStepSettled(step, accountWith({ diaries: ['Ardougne Medium'] }))).toBe(true)
    expect(isStepSettled(step, accountWith({ allDiaries: true }))).toBe(true)
  })
})

describe('settleSteps', () => {
  const running = { ...questStep("Twilight's Promise", 'finish'), runningSince: NOW - 60_000 }
  const tier = questStep('Ardougne Medium', 'claim')
  const withSteps: Session = { ...SESSION, blocks: [...BLOCKS, running, tier] }

  it('ticks off the steps the account has done since the deal and stops their clocks', () => {
    const { session, settled } = settleSteps(
      withSteps,
      accountWith({ quests: ["Twilight's Promise"] }),
      NOW,
    )
    expect(settled.map((step) => step.title)).toEqual(["Twilight's Promise"])
    expect(session.blocks[3]).toMatchObject({ done: true, runningSince: null, elapsed: 60_000 })
    expect(session.blocks[4]).toEqual(tier)
    // everything else is left as it was
    expect(session.blocks.slice(0, 3)).toEqual(BLOCKS)
  })

  it('leaves the session alone when nothing is settled, a step is already done, or it is tallied', () => {
    expect(settleSteps(withSteps, accountWith(), NOW)).toEqual({ session: withSteps, settled: [] })

    const doneAlready: Session = {
      ...SESSION,
      blocks: [{ ...questStep("Twilight's Promise", 'finish'), done: true }],
    }
    expect(settleSteps(doneAlready, accountWith({ allQuests: true }), NOW).settled).toEqual([])

    const tallied: Session = { ...withSteps, endedAt: NOW, tally: null }
    expect(settleSteps(tallied, accountWith({ allQuests: true }), NOW)).toEqual({
      session: tallied,
      settled: [],
    })
  })
})

describe('addToHistory', () => {
  const entryAt = (endedAt: number): HistoryEntry => ({
    endedAt,
    minutes: 60,
    elapsed: 0,
    gains: {},
    totalXp: 0,
    levels: {},
    blocks: [],
  })

  it('puts the newest entry first', () => {
    const history = addToHistory([entryAt(1)], entryAt(2))
    expect(history.map((entry) => entry.endedAt)).toEqual([2, 1])
  })

  it('drops the oldest entries past the limit', () => {
    const full = Array.from({ length: HISTORY_LIMIT }, (_, index) => entryAt(HISTORY_LIMIT - index))
    const history = addToHistory(full, entryAt(HISTORY_LIMIT + 1))
    expect(history).toHaveLength(HISTORY_LIMIT)
    expect(history[0]?.endedAt).toBe(HISTORY_LIMIT + 1)
    expect(history.at(-1)?.endedAt).toBe(2)
  })
})

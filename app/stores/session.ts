import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type { HistoryEntry, QuestBlock, Session, SessionBlock } from '#shared/types/session'
import type { SkillKey } from '#shared/types/skill'
import { SKILL_KEYS } from '#shared/data/skills'
import { dealSession, swapBlock as swapBlockIn } from '#shared/domain/planner'
import type { QuestStepPick } from '#shared/domain/quest-step'
import type { SavedState } from '#shared/domain/save'
import {
  completeBlock as completeBlockIn,
  finishSession,
  pauseAllBlocks,
  settleSteps as settleStepsIn,
  toggleBlock as toggleBlockIn,
} from '#shared/domain/session'
import { useAccountStore } from './account'
import { useHistoryStore } from './history'

/** The part of the save this store keeps. */
export type SavedSession = Pick<SavedState, 'session' | 'recentSkills'>

/**
 * Tonight's session, from the deal to the tally. The rules live in shared/domain (planner.ts and
 * session.ts); the actions here hand them the account, the clock and the dice.
 */
export const useSessionStore = defineStore('session', () => {
  /** Tonight's plan. Null before the first deal; a finished session stays until the next deal. */
  const session = shallowRef<Session | null>(null)
  /** The skills dealt lately, oldest first, so the next deal can avoid them. */
  const recentSkills = shallowRef<readonly SkillKey[]>([])
  /**
   * The place of a quest or diary step whose Done is waiting on the player's answer: did they
   * finish it? Not saved: after a reload its Done asks again.
   */
  const askingIndex = shallowRef<number | null>(null)

  /** The session has been tallied: its blocks are history and its gains are known. */
  const isFinished = computed(() => session.value !== null && session.value.endedAt !== null)

  /**
   * The place of the block to do now: a step waiting on an answer, else the one whose timer is
   * running, else the first that is not done. Null when there is no session, it is finished, or
   * every block is done.
   */
  const liveBlockIndex = computed<number | null>(() => {
    if (!session.value || isFinished.value) return null
    if (askingIndex.value !== null) return askingIndex.value
    const { blocks } = session.value
    const running = blocks.findIndex((block) => block.runningSince !== null)
    const live = running >= 0 ? running : blocks.findIndex((block) => !block.done)
    return live >= 0 ? live : null
  })

  const liveBlock = computed<SessionBlock | null>(() =>
    liveBlockIndex.value === null ? null : (session.value?.blocks[liveBlockIndex.value] ?? null),
  )

  /** The skill the live block trains: its own, or the one a reset feeds. A wildcard or a quest step has none. */
  const liveSkill = computed<SkillKey | null>(() => {
    const block = liveBlock.value
    return block?.kind === 'skill' || block?.kind === 'reset' ? block.skill : null
  })

  /** The skills that gained a level in the finished session, in hiscores order. */
  const levelledSkills = computed<readonly SkillKey[]>(() => {
    const levels = session.value?.tally?.levels ?? {}
    return SKILL_KEYS.filter((skill) => (levels[skill] ?? 0) > 0)
  })

  /** This store's part of the save. */
  const saved = computed<SavedSession>(() => ({
    session: session.value,
    recentSkills: recentSkills.value,
  }))

  /** Replaces everything here with what a save holds. */
  function restore(save: SavedSession): void {
    session.value = save.session
    recentSkills.value = save.recentSkills
    askingIndex.value = null
  }

  /**
   * Deals tonight's session from the account and its preferences, replacing any session there
   * is. It ends on `questStep` while the player has quest steps on: Tonight chooses the step
   * (quest-step.ts), so the rules behind it load with the pages that use them. Returns true when
   * a strict mood found nothing to deal and the session was dealt balanced instead, which the
   * player should be told.
   */
  function deal(questStep: QuestStepPick | null = null): boolean {
    const account = useAccountStore()
    const { minutes, mood, includeResets, includeWildcard, includeQuestStep } = account.preferences
    const dealt = dealSession({
      account: account.account,
      minutes,
      mood,
      includeResets,
      includeWildcard,
      questStep: includeQuestStep ? questStep : null,
      recentSkills: recentSkills.value,
      resetLog: account.resetLog,
      now: Date.now(),
      random: Math.random,
    })
    session.value = dealt.session
    recentSkills.value = dealt.recentSkills
    askingIndex.value = null
    return dealt.moodRelaxed
  }

  /**
   * Swaps a skill block for a different skill of the kind its slot was dealt for. Returns false
   * when there is nothing else to swap in, or the block is not a skill block.
   */
  function swapBlock(blockIndex: number): boolean {
    if (!session.value) return false
    const swapped = swapBlockIn({
      account: useAccountStore().account,
      session: session.value,
      blockIndex,
      random: Math.random,
    })
    if (!swapped) return false
    session.value = swapped
    return true
  }

  /**
   * Starts a block's timer, or pauses it if it is running. Starting one pauses any other, and
   * starting another block puts off a step's question: its Done asks again later.
   */
  function toggleBlock(blockIndex: number): void {
    if (!session.value) return
    if (askingIndex.value !== blockIndex) askingIndex.value = null
    session.value = toggleBlockIn(session.value, blockIndex, Date.now())
  }

  /** Marks a block done. A reset block also logs its reset, so it is not dealt again until due. */
  function completeBlock(blockIndex: number): void {
    if (!session.value) return
    if (askingIndex.value === blockIndex) askingIndex.value = null
    const completion = completeBlockIn(session.value, blockIndex, Date.now())
    session.value = completion.session
    if (completion.completedResetKey) {
      useAccountStore().markResetDone(completion.completedResetKey)
    }
  }

  /**
   * A quest or diary step's Done: its clock stops, and it is the live block while it asks whether
   * the player finished it. Anything else, or a step already done, is left alone.
   */
  function askStep(blockIndex: number): void {
    const block = session.value?.blocks[blockIndex]
    if (!session.value || block?.kind !== 'quest' || block.done) return
    if (block.runningSince !== null) {
      session.value = toggleBlockIn(session.value, blockIndex, Date.now())
    }
    askingIndex.value = blockIndex
  }

  /**
   * The answer to a step's question. Either way the step is done for tonight. Returns the step
   * when the answer was yes, for the caller to tick it (or mark it started), or null.
   */
  function answerStep(finished: boolean): QuestBlock | null {
    const blockIndex = askingIndex.value
    const block = blockIndex === null ? undefined : session.value?.blocks[blockIndex]
    if (blockIndex === null || block?.kind !== 'quest') return null
    completeBlock(blockIndex)
    return finished ? block : null
  }

  /**
   * Ticks off the quest or diary steps the account has done since the deal, for instance ones a
   * local add-on has just reported, and returns them for the player to be told. A step waiting
   * on its question stops asking.
   */
  function settleSteps(): readonly QuestBlock[] {
    if (!session.value) return []
    const { session: settledSession, settled } = settleStepsIn(
      session.value,
      useAccountStore().account,
      Date.now(),
    )
    if (settled.length === 0) return settled
    session.value = settledSession
    const asking = askingIndex.value === null ? undefined : settledSession.blocks[askingIndex.value]
    if (asking?.done) askingIndex.value = null
    return settled
  }

  /**
   * Stops every timer. Called the moment the player asks to finish, so the minutes it takes to
   * fetch their stats do not count as play.
   */
  function pauseAll(): void {
    if (!session.value) return
    session.value = pauseAllBlocks(session.value, Date.now())
  }

  /**
   * Closes the session and tallies what it brought in, measured against the stats the account
   * store holds now: refresh them first. The tally goes into the history and is returned; null
   * when there is no session to finish.
   */
  function finish(): HistoryEntry | null {
    if (!session.value || isFinished.value) return null
    askingIndex.value = null
    const finished = finishSession(session.value, useAccountStore().account.skills, Date.now())
    session.value = finished.session
    useHistoryStore().addEntry(finished.entry)
    return finished.entry
  }

  return {
    session,
    recentSkills,
    askingIndex,
    isFinished,
    liveBlockIndex,
    liveBlock,
    liveSkill,
    levelledSkills,
    saved,
    restore,
    deal,
    swapBlock,
    toggleBlock,
    completeBlock,
    askStep,
    answerStep,
    settleSteps,
    pauseAll,
    finish,
  }
})

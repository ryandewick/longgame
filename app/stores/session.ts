import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type { HistoryEntry, Session, SessionBlock } from '#shared/types/session'
import type { SkillKey } from '#shared/types/skill'
import { SKILL_KEYS } from '#shared/data/skills'
import { dealSession, swapBlock as swapBlockIn } from '#shared/domain/planner'
import type { SavedState } from '#shared/domain/save'
import {
  completeBlock as completeBlockIn,
  finishSession,
  pauseAllBlocks,
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

  /** The session has been tallied: its blocks are history and its gains are known. */
  const isFinished = computed(() => session.value !== null && session.value.endedAt !== null)

  /**
   * The place of the block to do now: the one whose timer is running, else the first that is not
   * done. Null when there is no session, it is finished, or every block is done.
   */
  const liveBlockIndex = computed<number | null>(() => {
    if (!session.value || isFinished.value) return null
    const { blocks } = session.value
    const running = blocks.findIndex((block) => block.runningSince !== null)
    const live = running >= 0 ? running : blocks.findIndex((block) => !block.done)
    return live >= 0 ? live : null
  })

  const liveBlock = computed<SessionBlock | null>(() =>
    liveBlockIndex.value === null ? null : (session.value?.blocks[liveBlockIndex.value] ?? null),
  )

  /** The skill the live block trains: its own, or the one a reset feeds. A wildcard has none. */
  const liveSkill = computed<SkillKey | null>(() => {
    const block = liveBlock.value
    return block && block.kind !== 'wildcard' ? block.skill : null
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
  }

  /** Drops the session and forgets which skills were dealt lately. */
  function clear(): void {
    restore({ session: null, recentSkills: [] })
  }

  /**
   * Deals tonight's session from the account and its preferences, replacing any session there
   * is. Returns true when a strict mood found nothing to deal and the session was dealt balanced
   * instead, which the player should be told.
   */
  function deal(): boolean {
    const account = useAccountStore()
    const { minutes, mood, includeResets, includeWildcard } = account.preferences
    const dealt = dealSession({
      account: account.account,
      minutes,
      mood,
      includeResets,
      includeWildcard,
      recentSkills: recentSkills.value,
      resetLog: account.resetLog,
      now: Date.now(),
      random: Math.random,
    })
    session.value = dealt.session
    recentSkills.value = dealt.recentSkills
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

  /** Starts a block's timer, or pauses it if it is running. Starting one pauses any other. */
  function toggleBlock(blockIndex: number): void {
    if (!session.value) return
    session.value = toggleBlockIn(session.value, blockIndex, Date.now())
  }

  /** Marks a block done. A reset block also logs its reset, so it is not dealt again until due. */
  function completeBlock(blockIndex: number): void {
    if (!session.value) return
    const completion = completeBlockIn(session.value, blockIndex, Date.now())
    session.value = completion.session
    if (completion.completedResetKey) {
      useAccountStore().markResetDone(completion.completedResetKey)
    }
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
    const finished = finishSession(session.value, useAccountStore().account.skills, Date.now())
    session.value = finished.session
    useHistoryStore().addEntry(finished.entry)
    return finished.entry
  }

  return {
    session,
    recentSkills,
    isFinished,
    liveBlockIndex,
    liveBlock,
    liveSkill,
    levelledSkills,
    saved,
    restore,
    clear,
    deal,
    swapBlock,
    toggleBlock,
    completeBlock,
    pauseAll,
    finish,
  }
})

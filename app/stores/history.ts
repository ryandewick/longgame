import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type { HistoryEntry } from '#shared/types/session'
import type { SkillKey } from '#shared/types/skill'
import type { XpSnapshot } from '#shared/types/snapshot'
import {
  dailyGains as dailyGainsFrom,
  dayStreak as dayStreakFrom,
  paceOver,
  type DailyGain,
  type Pace,
} from '#shared/domain/pace'
import type { SavedState } from '#shared/domain/save'
import { addToHistory } from '#shared/domain/session'

/** The part of the save this store keeps. The snapshots are stored apart from it, by player name. */
export type SavedHistory = Pick<SavedState, 'history'>

/**
 * What the account has done: finished sessions, and the XP snapshot taken at every hiscores
 * fetch. Pace, daily gains and the streak are read from these by shared/domain/pace.ts.
 *
 * The three questions take the time as their last argument because each answer depends on what
 * day it is; left out, it is now.
 */
export const useHistoryStore = defineStore('history', () => {
  /** Finished sessions, newest first. */
  const entries = shallowRef<readonly HistoryEntry[]>([])
  /** The account's XP at each hiscores fetch, oldest first. */
  const snapshots = shallowRef<readonly XpSnapshot[]>([])

  /** This store's part of the save. */
  const saved = computed<SavedHistory>(() => ({ history: entries.value }))

  /** Replaces the finished sessions with what a save holds. Snapshots are loaded separately. */
  function restore(save: SavedHistory): void {
    entries.value = save.history
  }

  /** Puts a finished session at the front of the history. */
  function addEntry(entry: HistoryEntry): void {
    entries.value = addToHistory(entries.value, entry)
  }

  /** Takes in the XP history as storage now holds it, oldest first. */
  function setSnapshots(history: readonly XpSnapshot[]): void {
    snapshots.value = history
  }

  /** XP gained on each of the last `days` calendar days, oldest first and ending today. */
  function dailyGains(days: number, now: number = Date.now()): DailyGain[] {
    return dailyGainsFrom(snapshots.value, days, now)
  }

  /** XP per day over the last `days` days: in one skill, or in total when no skill is given. */
  function pace(days: number, skill?: SkillKey, now: number = Date.now()): Pace {
    return paceOver(snapshots.value, days, now, skill)
  }

  /** How many days in a row the account has gained XP. */
  function dayStreak(now: number = Date.now()): number {
    return dayStreakFrom(entries.value, snapshots.value, now)
  }

  return {
    entries,
    snapshots,
    saved,
    restore,
    addEntry,
    setSnapshots,
    dailyGains,
    pace,
    dayStreak,
  }
})

import { isDoneByEveryAccount } from '#shared/domain/account'

/**
 * Pressing a quest's or a diary tier's tick box by hand, wherever on the Quests page that is done.
 * A press can move more than its own row (ticking a quest ticks the quests it requires, ticking a
 * tier the tiers below it and what its tasks need, unticking takes away what needed it: see
 * shared/domain/quest-ticks.ts), so the player is told in a toast what else moved.
 */
export function useQuestToggle(): {
  toggleQuest: (questName: string) => void
  toggleDiary: (diary: string) => void
} {
  const account = useAccountStore()
  const toast = useToast()

  function toggleQuest(questName: string): void {
    // Learning the Ropes is done by every account: there is no tick to take away, so say why.
    if (isDoneByEveryAccount(questName)) {
      toast.show(doneByEveryAccountNote(questName))
      return
    }
    // While the quest cape shortcut is on, every quest reads as done whatever is ticked underneath.
    // A press then can only take a hand tick away: adding one would change nothing on screen and
    // leave a tick behind for when the shortcut is turned off.
    if (account.allQuests && !account.completedQuests.includes(questName)) return
    const news = questStepNews(questName, account.stepQuest(questName))
    if (news) toast.show(news.message, news.lead)
  }

  function toggleDiary(diary: string): void {
    // While the diary shortcut is on, every tier reads as done whatever is ticked underneath. A
    // press then can only take a hand tick away, for the same reason as the quest cape's.
    if (account.allDiaries && !account.completedDiaries.includes(diary)) return
    const news = diaryStepNews(diary, account.toggleDiary(diary))
    if (news) toast.show(news.message, news.lead)
  }

  return { toggleQuest, toggleDiary }
}

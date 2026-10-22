import { isDoneByEveryAccount } from '#shared/domain/account'

/**
 * Ticking a quest by hand, wherever on the Quests page that is done. A quest brings its chain
 * with it (ticking one ticks the quests it requires, unticking one unticks the quests that
 * require it: see shared/domain/quest-ticks.ts), so the player is told in a toast what else moved.
 */
export function useQuestToggle(): { toggleQuest: (questName: string) => void } {
  const account = useAccountStore()
  const toast = useToast()

  function toggleQuest(questName: string): void {
    // Learning the Ropes is done by every account: there is no tick to take away, so say why.
    if (isDoneByEveryAccount(questName)) {
      toast.show(doneByEveryAccountNote(questName))
      return
    }
    // While the quest cape shortcut is on, every quest reads as done whatever is ticked underneath.
    // A click then can only take a hand tick away: adding one would change nothing on screen and
    // leave a tick behind for when the shortcut is turned off.
    if (account.allQuests && !account.completedQuests.includes(questName)) return
    const { ticked, alsoChanged } = account.toggleQuest(questName)
    const also = alsoChangedSentence(ticked, alsoChanged)
    if (also) toast.show(also, `${questName} ${ticked ? 'ticked' : 'unticked'}.`)
  }

  return { toggleQuest }
}

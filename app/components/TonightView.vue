<script setup lang="ts">
import { questStepFor } from '#shared/domain/quest-step'

/**
 * Tonight: the session to play now (the deal, the live block, the tally) beside the resets that are due, the
 * capes closest to 99 and the distance to max.
 *
 * The panels below draw; this is where their buttons meet the stores, and where the player is
 * asked before anything that throws work away. It is also where the moments the page marks with
 * motion are announced (a deal, a block going live, a swap, the tally: see useMotion), because
 * the stores are not to know about motion and this is what calls them.
 */
const account = useAccountStore()
const session = useSessionStore()
const history = useHistoryStore()
const toast = useToast()
const { confirm } = useConfirm()
const { isRefreshing, refresh } = useStatsRefresh()
const { markQuest, markDiary } = useQuestToggle()

/**
 * The quest or diary step the next deal ends on, while the player has quest steps on
 * (quest-step.ts). Worked out here rather than in the store, so the suggestion rules load with
 * the pages that use them; it is only worked out when something reads it.
 */
const questStep = computed(() => {
  const { includeQuestStep, minutes, mood } = account.preferences
  return includeQuestStep ? questStepFor(account.account, minutes, mood) : null
})

/** True from the moment the player confirms the finish until the tally is in. */
const isFinishing = shallowRef(false)

/**
 * How many questions about the account's quests are waiting that would change its hours, for the
 * prompt above the deal. The smaller questions are not worth a prompt. None where a local add-on
 * fills quests in, and none once the player has put them off for this visit.
 */
const asksQuestions = !useQuestProgressProvider()
const { isPutOff, putOff } = useQuestionRun()
const questionsWaiting = computed(() =>
  asksQuestions && !isPutOff.value ? account.planQuestions.savingHours.length : 0,
)

function deal(): void {
  // read before dealing: this is the mood the deal was asked for
  const { mood } = account.preferences
  const moodRelaxed = session.deal(questStep.value)
  announceMoment({ name: 'deal' })
  // said outright: the first block of a fresh deal goes live even when the last deal's first
  // block was the live one too, and the place of the live block has not changed
  announceMoment({ name: 'live' })
  const message = moodRelaxed ? moodRelaxedMessage(mood) : null
  if (message) toast.show(message)
}

async function dealAgain(): Promise<void> {
  const confirmed = await confirm({
    title: 'Deal again',
    body: 'Throw away tonight’s blocks and deal a fresh set?',
    confirmLabel: 'Deal again',
  })
  if (confirmed) deal()
}

function swap(blockIndex: number): void {
  const block = session.session?.blocks[blockIndex]
  if (block?.kind !== 'skill') return
  if (!session.swapBlock(blockIndex)) {
    toast.show(nothingToSwapMessage(block.wanted))
    return
  }
  announceMoment({ name: 'swap', blockIndex })
  // the live block is at the same place in the session as before, but it is a different block now
  if (blockIndex === session.liveBlockIndex) announceMoment({ name: 'live' })
}

/**
 * A block's Done. A quest or diary step first stops its clock and asks whether the player
 * finished it, so that a yes can tick it; any other block is simply done.
 */
function done(blockIndex: number): void {
  if (session.session?.blocks[blockIndex]?.kind === 'quest') session.askStep(blockIndex)
  else session.completeBlock(blockIndex)
}

/**
 * The answer to a step's question. Either way the step is done for tonight; a yes also ticks
 * its quest or tier (or marks the quest started) through the account store, and says so.
 */
function answer(finished: boolean): void {
  const step = session.answerStep(finished)
  if (!step) return
  if (step.step === 'claim') markDiary(step.title)
  else markQuest(step.title, step.step === 'start' ? 'started' : 'finished')
}

// A different place in the session has become the one to do now: the block before it was ticked
// done, or the player started another block's timer.
watch(
  () => session.liveBlockIndex,
  (liveBlockIndex) => {
    if (liveBlockIndex !== null) announceMoment({ name: 'live' })
  },
)

/** Resolves once no stats lookup is running. */
function lookupSettled(): Promise<void> {
  if (!isRefreshing.value) return Promise.resolve()
  return new Promise((resolve) => {
    watch(isRefreshing, () => resolve(), { once: true })
  })
}

async function finish(): Promise<void> {
  const confirmed = await confirm({
    title: 'Finish the session',
    body: 'Log out or hop worlds first so the hiscores catch up, then finish. I will fetch your stats and tally the gains.',
    confirmLabel: 'Finish',
  })
  if (!confirmed || isFinishing.value) return
  isFinishing.value = true
  try {
    // the timers stop now, so the time it takes to fetch the stats is not counted as play
    session.pauseAll()
    // a lookup already on its way (the header's button) would make `refresh` do nothing, and the
    // tally would be measured against stats from before the session
    await lookupSettled()
    // if the lookup fails its reason is shown, and the tally is made from the stats there are:
    // the gains then land in History at the next refresh
    await refresh()
    if (session.finish()) announceMoment({ name: 'tally' })
  } finally {
    isFinishing.value = false
  }
}
</script>

<template>
  <div class="tonight-view">
    <div class="tonight-view__main">
      <template v-if="!session.session || session.isFinished">
        <QuestsPrompt
          v-if="questionsWaiting"
          class="tonight-view__prompt"
          :count="questionsWaiting"
          @dismiss="putOff"
        />
        <DealPanel :quest-step="questStep" @deal="deal" />
        <SessionTally v-if="session.session" :session="session.session" />
        <p v-if="!history.entries.length" class="note tonight-view__hint">
          <b class="note__strong">How it works.</b>
          Every block is one skill, one method, one timer. Start the timer when you start, tick Done
          when you stop. When you finish the session, log out so the hiscores update, then press
          Finish and it tallies exactly what you gained.
        </p>
      </template>

      <template v-else>
        <!-- keyed by the block's place, so the next block starts with a clean panel -->
        <LivePanel
          v-if="session.liveBlock && session.liveBlockIndex !== null"
          :key="session.liveBlockIndex"
          :block="session.liveBlock"
          :asking="session.askingIndex === session.liveBlockIndex"
          @toggle="session.toggleBlock(session.liveBlockIndex)"
          @done="done(session.liveBlockIndex)"
          @swap="swap(session.liveBlockIndex)"
          @answer="answer"
        />
        <FinishPanel
          v-else
          :session="session.session"
          :finishing="isFinishing"
          @finish="finish"
          @redeal="dealAgain"
        />
        <SessionQueue
          :session="session.session"
          :live-block-index="session.liveBlockIndex"
          :finishing="isFinishing"
          @toggle="session.toggleBlock"
          @done="done"
          @swap="swap"
          @finish="finish"
          @redeal="dealAgain"
        />
      </template>
    </div>

    <aside class="tonight-view__side">
      <ResetsPanel />
      <NextCapes />
      <MaxSummary />
    </aside>
  </div>
</template>

<style lang="scss">
.tonight-view {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  align-items: start;
  gap: 40px;

  &__side {
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  &__prompt {
    margin-bottom: 16px;
  }

  &__hint {
    margin-top: 26px;
  }

  @media (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

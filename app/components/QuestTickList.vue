<script setup lang="ts">
import { DIARY_REGIONS, DIARY_TIERS } from '#shared/data/diaries'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import { hasCompletedDiary } from '#shared/domain/account'
import { gatingQuests } from '#shared/domain/quests'

/**
 * The tick list part of the Quests page: everything the account can be told by hand. The quests
 * that unlock something come first, each with what it opens up, with the diary tiers beside
 * them; every other quest, miniquest and activity follows, to be searched and filtered. It is
 * also where an answer to a question is undone: untick the quest, or tick one that was answered
 * "not yet".
 */
const account = useAccountStore()
const { toggleQuest, toggleDiary } = useQuestToggle()

// which quests gate something is a fact of the data, the same for every account
const GATING_QUESTS = gatingQuests()
const OTHER_QUESTS = QUEST_FACTS.filter((entry) => !GATING_QUESTS.includes(entry.name))

const EVERY_DIARY = DIARY_REGIONS.flatMap((region) =>
  DIARY_TIERS.map((tier) => `${region} ${tier}`),
)

const unlocks = computed(() => unlockRows(account.account, GATING_QUESTS))
const others = computed(() => questRows(account.account, OTHER_QUESTS))

const completedDiaries = computed(
  () => new Set(EVERY_DIARY.filter((diary) => hasCompletedDiary(account.account, diary))),
)
</script>

<template>
  <div class="quest-tick-list">
    <div class="quest-tick-list__columns">
      <section>
        <div class="section-heading section-heading--first">
          <h2 class="section-heading__title">Quests that unlock training methods</h2>
          <span class="section-heading__aside">{{ tickedCountLabel(unlocks) }}</span>
        </div>
        <p class="note quest-tick-list__lead">
          These change your plan the most. Each one shows what it opens up. Ticking a quest also
          ticks the quests it requires, and unticking one unticks the quests that require it. A few
          quests count once started, like Fairytale II for the fairy rings: press one of those once
          for started and again for done.
        </p>
        <UnlockList :quests="unlocks" @toggle="toggleQuest" />
      </section>

      <section>
        <div class="section-heading section-heading--first">
          <h2 class="section-heading__title">Achievement diaries</h2>
          <span class="section-heading__aside">
            {{ completedDiaries.size }} of {{ EVERY_DIARY.length }} ticked
          </span>
        </div>
        <p class="note quest-tick-list__lead">
          Tick each tier you have claimed. The tiers below it, and the quests its tasks need, are
          ticked with it.
        </p>
        <DiaryGrid :completed="completedDiaries" @toggle="toggleDiary" />
      </section>
    </div>

    <section>
      <div class="section-heading">
        <h2 class="section-heading__title">Every other quest</h2>
        <span class="section-heading__aside">{{ tickedCountLabel(others) }}</span>
      </div>
      <p class="note quest-tick-list__lead">
        Miniquests and activities are here too, marked as such. Ticking one also ticks what it
        requires, and marks started the quests it needs only started.
      </p>
      <QuestChecklist :rows="others" @toggle="toggleQuest" />
    </section>
  </div>
</template>

<style lang="scss">
.quest-tick-list {
  &__columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    align-items: start;
    gap: 48px;
  }

  &__lead {
    margin-bottom: 10px;
  }

  @media (max-width: 1100px) {
    &__columns {
      grid-template-columns: minmax(0, 1fr);
      gap: 32px;
    }
  }
}
</style>

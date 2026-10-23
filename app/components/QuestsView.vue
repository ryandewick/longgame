<script setup lang="ts">
import { DIARY_REGIONS, DIARY_TIERS } from '#shared/data/diaries'
import { hasCompletedDiary, hasCompletedQuest } from '#shared/domain/account'
import { knownQuests } from '#shared/domain/quests'

/**
 * Quests: where the account's quests and diaries are told to the planner, which the hiscores say
 * nothing about, and what to do with them next. The page has four parts, each behind a tab and
 * each with an address of its own (/quests?tab=next):
 *
 * - Questions: a short run of yes or no questions about the quests that would change the plan;
 * - Next: what to do now and why: quests that save hours, unlocks, diary tiers to claim;
 * - Goals: the milestones, with how far along each the account is;
 * - Tick list: every quest and diary tier, to tick by hand.
 *
 * A local copy whose add-on reports quest progress asks nothing, so it has no Questions part.
 */
const account = useAccountStore()
const route = useRoute()
const asksQuestions = !useQuestProgressProvider()

// what the app knows by name is a fact of the data, the same for every account
const KNOWN_QUESTS = knownQuests()
const EVERY_DIARY = DIARY_REGIONS.flatMap((region) =>
  DIARY_TIERS.map((tier) => `${region} ${tier}`),
)

/** The questions that save hours: what the tab counts, as the prompt on Tonight does. */
const hourQuestions = computed(() => account.planQuestions.savingHours.length)
/** Every question of either round: while there is one, the page opens at the questions. */
const questionsWaiting = computed(() => hourQuestions.value + account.planQuestions.smaller.length)

const tab = computed(() =>
  questsTabFor(route.query.tab, { asksQuestions, questionsWaiting: questionsWaiting.value }),
)

const tabs = computed(() =>
  QUESTS_TABS.filter((entry) => entry.tab !== 'questions' || asksQuestions).map((entry) => ({
    ...entry,
    path: questsTabPath(entry.tab),
    isCurrent: entry.tab === tab.value,
    // the questions tab says how many of the ones that save hours are waiting
    count: entry.tab === 'questions' ? hourQuestions.value : 0,
  })),
)

// The address always names the part on show. Without that, the questions part would give way to
// the tick list the moment its last question was answered, before the player had read how it ended.
watch(
  // only while this is the page on show: the route moves on before the page is taken down
  () => route.path === '/quests' && route.query.tab !== tab.value,
  (isUnnamed) => {
    if (isUnnamed) void navigateTo(questsTabPath(tab.value), { replace: true })
  },
  { immediate: true },
)

const questsTicked = computed(
  () => KNOWN_QUESTS.filter((quest) => hasCompletedQuest(account.account, quest)).length,
)
const diariesTicked = computed(
  () => EVERY_DIARY.filter((diary) => hasCompletedDiary(account.account, diary)).length,
)
</script>

<template>
  <div class="quests-view">
    <div class="section-heading section-heading--first">
      <h1 class="section-heading__title section-heading__title--page">Quests and diaries</h1>
    </div>

    <p v-if="asksQuestions" class="quests-view__why">
      Long Game can read your levels but not your quests or diaries. It asks about the few that
      would change your plan, biggest first, and stops when nothing left would make a difference.
      The tick list has every one of them.
    </p>
    <p v-else class="quests-view__status">
      <b class="quests-view__status-lead">
        Quest and diary progress is filled in by a local add-on.
      </b>
      Each time your stats refresh, the quests and diaries the add-on reports as done are ticked
      below. Ticking by hand still works, and so do the two shortcuts.
    </p>

    <QuestSummary
      class="quests-view__summary"
      :quests-ticked="questsTicked"
      :quest-count="KNOWN_QUESTS.length"
      :diaries-ticked="diariesTicked"
      :diary-count="EVERY_DIARY.length"
      :hours-to-max="account.maxProgress.hoursLeft"
      :all-quests="account.allQuests"
      :all-diaries="account.allDiaries"
      @toggle-all-quests="account.setAllQuests(!account.allQuests)"
      @toggle-all-diaries="account.setAllDiaries(!account.allDiaries)"
    />

    <nav class="chip-group quests-view__tabs" aria-label="Parts of this page">
      <NuxtLink
        v-for="entry in tabs"
        :key="entry.tab"
        :to="entry.path"
        replace
        class="chip"
        :class="{ 'chip--selected': entry.isCurrent }"
        :aria-current="entry.isCurrent ? 'page' : undefined"
      >
        {{ entry.label }}
        <template v-if="entry.count">({{ entry.count }})</template>
      </NuxtLink>
    </nav>

    <QuestQuestions v-if="tab === 'questions'" />
    <QuestNext v-else-if="tab === 'next'" />
    <QuestGoals v-else-if="tab === 'goals'" />
    <QuestTickList v-else />
  </div>
</template>

<style lang="scss">
.quests-view {
  &__why {
    max-width: 78ch;
    color: var(--color-text-muted);
  }

  // the status bar: a panel-coloured strip saying where the page's ticks come from
  &__status {
    padding: 14px 18px;
    border-radius: var(--radius);
    background: var(--color-panel);
    box-shadow: 0 0 0 1px var(--color-edge);
    color: var(--color-text-muted);
  }

  &__status-lead {
    color: var(--color-text-strong);
  }

  &__summary {
    margin-top: 22px;
  }

  &__tabs {
    margin: 26px 0;
  }
}
</style>

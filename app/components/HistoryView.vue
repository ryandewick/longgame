<script setup lang="ts">
import { formatShortNumber } from '#shared/domain/format'

/**
 * History: XP per day over the last fortnight, read from the snapshots taken at every stats
 * refresh, and the sessions that have been finished.
 */
const history = useHistoryStore()

/** How many days the chart covers. */
const CHART_DAYS = 14

// the chart ends today, so it has to notice midnight; a minute behind is near enough
const now = useNow(60_000)

const gains = computed(() => history.dailyGains(CHART_DAYS, now.value))
const weekXp = computed(() => `+${formatShortNumber(xpThisWeek(gains.value))}`)
const counts = computed(() =>
  historyCountsSentence({
    dayStreak: history.dayStreak(now.value),
    sessions: history.entries.length,
    snapshots: history.snapshots.length,
  }),
)
</script>

<template>
  <div class="history-view">
    <h1 class="visually-hidden">History</h1>

    <section>
      <div class="section-heading section-heading--first">
        <h2 class="section-heading__title section-heading__title--page">
          Last {{ CHART_DAYS }} days
        </h2>
        <span class="section-heading__aside">
          XP per day from your snapshots. Refresh stats after playing and the bars fill in.
        </span>
      </div>
      <p class="note note--lead history-view__lead">
        <GameNumber>{{ weekXp }}</GameNumber> xp this week. {{ counts }}
      </p>
      <HistoryChart :gains="gains" />
    </section>

    <section>
      <div class="section-heading">
        <h2 class="section-heading__title section-heading__title--page">Sessions</h2>
      </div>
      <SessionsTable v-if="history.entries.length" :entries="history.entries" />
      <p v-else class="note history-view__empty">No sessions yet. Deal one in Tonight.</p>
    </section>
  </div>
</template>

<style lang="scss">
.history-view {
  &__lead {
    margin-bottom: 18px;
  }

  &__empty {
    margin-top: 8px;
  }
}
</style>

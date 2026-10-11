<script setup lang="ts">
/**
 * How far the whole account is from maxing: the share of the XP banked, how long the rest takes
 * at the pace of the last week, and how many days in a row the account has gained XP.
 */
const account = useAccountStore()
const history = useHistoryStore()

/** The pace is measured over this many days. */
const PACE_WINDOW_IN_DAYS = 7

const figures = computed(() => [
  { label: 'XP banked', value: xpBankedLabel(account.maxProgress) },
  {
    label: `At your ${PACE_WINDOW_IN_DAYS}-day pace`,
    value: daysToMaxLabel(account.maxProgress, history.pace(PACE_WINDOW_IN_DAYS).xpPerDay),
  },
  { label: 'Day streak', value: String(history.dayStreak()) },
])
</script>

<template>
  <section class="max-summary">
    <div class="section-heading section-heading--first">
      <h3 class="section-heading__title">To max</h3>
      <GameNumber>{{ account.maxProgress.percent.toFixed(2) }}%</GameNumber>
    </div>

    <dl class="max-summary__figures">
      <div v-for="figure in figures" :key="figure.label" class="max-summary__figure">
        <dt class="max-summary__label">{{ figure.label }}</dt>
        <dd class="max-summary__value">{{ figure.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style lang="scss">
.max-summary {
  &__figures {
    margin: 10px 0 0;
  }

  &__figure {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 0;
  }

  &__label {
    color: var(--color-text-muted);
  }

  &__value {
    margin: 0;
    font-weight: 700;
    font-variant-numeric: tabular-nums lining-nums;
  }
}
</style>

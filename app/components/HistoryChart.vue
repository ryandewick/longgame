<script setup lang="ts">
import type { DailyGain } from '#shared/domain/pace'

/**
 * XP gained per day as a row of bars, oldest first and ending today: each bar as tall as its
 * day's share of the best day, with the gain written above it and the weekday below. Today's
 * bar is bone and its weekday white.
 *
 * The bars are a picture. The same days are listed in words for anyone who cannot see them.
 */
const { gains } = defineProps<{
  /** One entry per day, oldest first, the last being today. */
  gains: readonly DailyGain[]
}>()

const bars = computed(() => historyChartBars(gains))
</script>

<template>
  <figure
    class="history-chart"
    :style="{ '--history-chart-days': bars.length }"
    :aria-label="`XP gained per day over the last ${bars.length} days`"
  >
    <div class="history-chart__bars" aria-hidden="true">
      <div v-for="bar in bars" :key="bar.day" class="history-chart__day" :title="bar.title">
        <GameNumber v-if="bar.label" class="history-chart__value">{{ bar.label }}</GameNumber>
        <span
          class="history-chart__bar"
          :class="{ 'history-chart__bar--today': bar.isToday }"
          :style="{ height: `${bar.heightPercent}%` }"
        />
      </div>
    </div>
    <div class="history-chart__weekdays" aria-hidden="true">
      <span
        v-for="bar in bars"
        :key="bar.day"
        class="history-chart__weekday"
        :class="{ 'history-chart__weekday--today': bar.isToday }"
      >
        {{ bar.weekday }}
      </span>
    </div>
    <ol class="visually-hidden">
      <li v-for="bar in bars" :key="bar.day">{{ bar.description }}</li>
    </ol>
  </figure>
</template>

<style lang="scss">
.history-chart {
  margin: 0 0 8px;

  &__bars,
  &__weekdays {
    display: grid;
    grid-template-columns: repeat(var(--history-chart-days), minmax(0, 1fr));
    gap: 8px;
  }

  &__bars {
    align-items: end;
    height: 200px;
    border-bottom: 1px solid var(--color-edge-strong);
  }

  // a day's column: its gain, then its bar standing on the baseline
  &__day {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-end;
    min-width: 0;
    height: 100%;
  }

  &__value {
    margin-bottom: 5px;
    text-align: center;
  }

  // Square, and the colour of a strong edge. Today's is bone, the colour of a chosen chip:
  // yellow belongs to the figures above the bars, not to the bars.
  &__bar {
    display: block;
    min-height: 0;
    background: var(--color-edge-strong);

    &--today {
      background: var(--color-text);
    }
  }

  &__weekdays {
    margin-top: 6px;
  }

  &__weekday {
    color: var(--color-text-faint);
    font: 600 13px/1.2 var(--font-text);
    text-align: center;

    &--today {
      color: var(--color-text-strong);
    }
  }

  // Phones: fourteen columns leave no room for a figure set across, so each is set down its bar.
  @media (max-width: 760px) {
    &__bars,
    &__weekdays {
      gap: 4px;
    }

    &__value {
      align-self: center;
      writing-mode: vertical-rl;
    }
  }
}
</style>

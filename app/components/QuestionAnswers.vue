<script setup lang="ts">
import { formatNumber } from '#shared/domain/format'

/**
 * The list beside the question card: the answers given this visit, the question being asked and
 * the ones still to come, with the hours to max before the first answer and now.
 */
const { hoursNow, hoursBefore } = defineProps<{
  rows: readonly AnswerRow[]
  /** Hours to max as the account stands. */
  hoursNow: number
  /** Hours to max before the first answer of this visit; the same as `hoursNow` until one is given. */
  hoursBefore: number
}>()

const now = computed(() => formatNumber(hoursNow))
const before = computed(() => formatNumber(hoursBefore))
const hasMoved = computed(() => now.value !== before.value)
</script>

<template>
  <section class="question-answers">
    <h2 class="question-answers__title">Your answers, and what is still to come</h2>
    <p class="question-answers__hours">
      <GameNumber>{{ now }} h</GameNumber> to max now<template v-if="hasMoved"
        >, <GameNumber tone="white">was {{ before }} h</GameNumber> before you answered
        anything</template
      >
    </p>

    <ol class="question-answers__list">
      <li
        v-for="(row, index) in rows"
        :key="row.key"
        class="question-answers__row"
        :class="{
          'question-answers__row--banded': index % 2 === 0,
          'question-answers__row--asking': row.state === 'asking',
        }"
        :aria-current="row.state === 'asking' ? 'step' : undefined"
      >
        <span class="question-answers__name">
          <b
            class="question-answers__quest"
            :class="{ 'question-answers__quest--to-come': row.state === 'to-come' }"
          >
            {{ row.name }}
          </b>
          <span v-if="row.note" class="question-answers__note">{{ row.note }}</span>
        </span>
        <span class="question-answers__state">
          <span
            v-if="row.stateLabel"
            class="tag"
            :class="{ 'tag--filled': row.state === 'done' || row.state === 'asking' }"
          >
            {{ row.stateLabel }}
          </span>
          <span v-else-if="row.share" class="question-answers__bar" aria-hidden="true">
            <span class="question-answers__fill" :style="{ width: `${row.share}%` }" />
          </span>
        </span>
        <span class="question-answers__figure">
          <GameNumber v-if="row.saved">{{ row.saved }}</GameNumber>
          <template v-else>{{ row.mayCome }}</template>
        </span>
      </li>
    </ol>
  </section>
</template>

<style lang="scss">
.question-answers {
  &__title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: 0;
  }

  &__hours {
    margin-top: 8px;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  &__list {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 120px 124px;
    align-items: center;
    gap: 14px;
    padding: 8px 10px;
    border-radius: var(--radius);

    &--banded {
      background: var(--color-slot);
    }

    // the question on the card is ringed as well as labelled
    &--asking {
      box-shadow: 0 0 0 2px var(--color-edge-strong);
    }
  }

  &__name {
    min-width: 0;
  }

  &__quest {
    color: var(--color-text-strong);
    font-weight: 700;

    &--to-come {
      color: var(--color-text-muted);
      font-weight: 600;
    }
  }

  &__note {
    display: block;
    color: var(--color-text-faint);
    font-size: 13px;
    line-height: 1.3;
  }

  &__state {
    min-width: 0;
  }

  // how big a saving is next to the biggest still to come
  &__bar {
    display: block;
    height: 6px;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--color-raised);
  }

  &__fill {
    display: block;
    height: 100%;
    background: var(--color-edge-strong);
  }

  &__figure {
    color: var(--color-text-faint);
    font-size: 13px;
    font-weight: 500;
    text-align: right;
    white-space: nowrap;
  }

  @media (max-width: 760px) {
    &__row {
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 10px;
    }

    // the bar is dropped where there is no room for it; the figure beside it says the same
    &__bar {
      display: none;
    }
  }
}
</style>

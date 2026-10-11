<script setup lang="ts">
import { formatNumber } from '#shared/domain/format'

/**
 * The Quests page at a glance: how many quests and diary tiers are ticked, the hours to max they
 * leave, and the two shortcuts for an account that has done everything. The figures move as the
 * player answers and ticks.
 */
const { hoursToMax } = defineProps<{
  questsTicked: number
  questCount: number
  diariesTicked: number
  diaryCount: number
  hoursToMax: number
  /** The quest cape shortcut is on: every quest counts as done. */
  allQuests: boolean
  /** The diary shortcut is on: every diary tier counts as done. */
  allDiaries: boolean
}>()

const emit = defineEmits<{
  /** The player pressed "I have the quest cape": whoever holds the shortcut flips it. */
  toggleAllQuests: []
  /** The player pressed "I have done every diary". */
  toggleAllDiaries: []
}>()

const hours = computed(() => formatNumber(hoursToMax))
</script>

<template>
  <section class="quest-summary" aria-label="Summary">
    <dl class="quest-summary__figures">
      <div class="quest-summary__figure">
        <dt class="quest-summary__label">quests ticked</dt>
        <dd class="quest-summary__value">
          <GameNumber size="headline">{{ questsTicked }}</GameNumber>
          <GameNumber tone="white">of {{ questCount }}</GameNumber>
        </dd>
      </div>
      <div class="quest-summary__figure">
        <dt class="quest-summary__label">diary tiers ticked</dt>
        <dd class="quest-summary__value">
          <GameNumber size="headline">{{ diariesTicked }}</GameNumber>
          <GameNumber tone="white">of {{ diaryCount }}</GameNumber>
        </dd>
      </div>
      <div class="quest-summary__figure">
        <dt class="quest-summary__label">hours to max, updated as you answer</dt>
        <dd class="quest-summary__value">
          <GameNumber size="headline">{{ hours }}</GameNumber>
        </dd>
      </div>
    </dl>

    <div class="quest-summary__shortcuts">
      <span class="quest-summary__hint">One click if it applies to you</span>
      <div class="chip-group" role="group" aria-label="Shortcuts">
        <ToggleChip :pressed="allQuests" @toggle="emit('toggleAllQuests')">
          I have the quest cape
        </ToggleChip>
        <ToggleChip :pressed="allDiaries" @toggle="emit('toggleAllDiaries')">
          I have done every diary
        </ToggleChip>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.quest-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px 44px;
  padding: 18px 22px;
  border-radius: var(--radius);
  background: var(--color-panel);
  box-shadow: 0 0 0 1px var(--color-edge);

  &__figures {
    display: flex;
    flex-wrap: wrap;
    gap: 18px 44px;
    margin: 0;
  }

  // the figure is read first and its label under it, though the label comes first in the markup
  &__figure {
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
  }

  &__label {
    color: var(--color-text-muted);
    font-size: 13px;
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
  }

  &__shortcuts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  &__hint {
    color: var(--color-text-faint);
    font-size: 13px;
  }

  @media (max-width: 760px) {
    padding: 16px;

    &__figures {
      gap: 16px 28px;
    }

    &__shortcuts {
      align-items: flex-start;
    }
  }
}
</style>

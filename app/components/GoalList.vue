<script setup lang="ts">
/**
 * Goals with how far along each the account is: its name and what it gives, its quests and tiers
 * done of all of them, the time left (training included), a line that fills as it nears, what is
 * left, and the levels it is short of.
 */
defineProps<{
  rows: readonly GoalRow[]
}>()
</script>

<template>
  <!-- named a list outright: some browsers stop announcing one once its markers are styled away -->
  <ul class="goal-list" role="list">
    <li
      v-for="(row, index) in rows"
      :key="row.id"
      class="goal-list__row"
      :class="{ 'goal-list__row--banded': index % 2 === 0 }"
    >
      <div class="goal-list__head">
        <b class="goal-list__name">{{ row.name }}</b>
        <span class="goal-list__figures">
          <GameNumber>{{ row.progress }}</GameNumber>
          <GameNumber tone="white">{{ row.timeLeft }}</GameNumber>
        </span>
      </div>
      <span class="goal-list__gives">{{ row.gives }}</span>
      <span class="goal-list__track" role="img" :aria-label="row.progressLabel">
        <span class="goal-list__fill" :style="{ width: `${row.share.toFixed(1)}%` }" />
      </span>
      <span v-if="row.left || row.short" class="goal-list__left">
        {{ row.left }}
        <span v-if="row.short" class="goal-list__short">{{ row.short }}</span>
      </span>
    </li>
  </ul>
</template>

<style lang="scss">
.goal-list {
  margin: 0;
  padding: 0;
  list-style: none;

  &__row {
    display: grid;
    gap: 3px;
    padding: 12px 14px 13px;
    border-radius: var(--radius);

    &--banded {
      background: var(--color-slot);
    }
  }

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }

  &__name {
    color: var(--color-text-strong);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.25;
  }

  &__figures {
    display: flex;
    flex: none;
    gap: 12px;
  }

  &__gives {
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.45;
  }

  // how much of the goal is done: a thin bone line on the edge colour, never a colour of its own
  &__track {
    display: block;
    height: 3px;
    margin: 7px 0 4px;
    background: var(--color-edge);
  }

  &__fill {
    display: block;
    height: 100%;
    background: var(--color-text);
  }

  &__left {
    color: var(--color-text);
    font-size: 13px;
    line-height: 1.45;
  }

  // the levels short: the status bar's "something is missing" red
  &__short {
    color: var(--color-warning);
  }
}
</style>

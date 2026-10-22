<script setup lang="ts">
/**
 * Under the diary grid: each diary's next tier, the lowest one not claimed, and whether the
 * account is ready for it or what it still needs. A tier's reward needs the tiers below it, so this
 * is the tier to do in each region. The grid's cells have no room for words; this list does.
 */
defineProps<{
  rows: readonly DiaryNextRow[]
}>()
</script>

<template>
  <div class="diary-next">
    <div class="section-heading">
      <h3 class="section-heading__title">Next in each diary</h3>
    </div>
    <p class="note diary-next__lead">
      A tier needs the ones below it, so each diary’s next tier is the one to do.
    </p>
    <!-- named a list outright: some browsers stop announcing one once its markers are styled away -->
    <ul class="diary-next__list" role="list">
      <li
        v-for="(row, index) in rows"
        :key="row.region"
        class="diary-next__row"
        :class="{ 'diary-next__row--banded': index % 2 === 0 }"
      >
        <b class="diary-next__tier">{{ row.diary ?? row.region }}</b>
        <ReadinessLine :readiness="row" wrap />
      </li>
    </ul>
  </div>
</template>

<style lang="scss">
.diary-next {
  &__lead {
    margin-bottom: 10px;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__row {
    padding: 8px 10px;
    border-radius: var(--radius);

    &--banded {
      background: var(--color-slot);
    }
  }

  &__tier {
    display: block;
    color: var(--color-text-strong);
    font-weight: 700;
    line-height: 1.25;
  }
}
</style>

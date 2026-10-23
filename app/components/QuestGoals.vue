<script setup lang="ts">
import { goalGroups, goalsFor } from '#shared/domain/goals'

/**
 * The Goals part of the Quests page: the two capes and how far along each the account is, the
 * goals nearly there (under two hours left), the ones on the way, nearest first and training
 * included, and the ones done.
 */
const account = useAccountStore()

const groups = computed(() => goalGroups(account.account))
const counts = computed(() => capeCounts(account.account))
const nearlyThere = computed(() => goalRows(groups.value.nearlyThere))
const onTheWay = computed(() => goalRows(groups.value.onTheWay.slice(0, GOALS_ON_THE_WAY)))
const furtherOff = computed(() => furtherOffLine(groups.value.onTheWay))
const goalCount = computed(() => goalsFor(account.account).length)
</script>

<template>
  <div class="quest-goals">
    <div class="quest-goals__top">
      <GoalCapes :counts="counts" />
      <section>
        <div class="section-heading section-heading--first">
          <h2 class="section-heading__title">Nearly there</h2>
          <span class="section-heading__aside">under two hours left, nearest first</span>
        </div>
        <GoalList v-if="nearlyThere.length" :rows="nearlyThere" />
        <p v-else class="note">No goal is under two hours away.</p>
      </section>
    </div>

    <div class="quest-goals__bottom">
      <section>
        <div class="section-heading section-heading--first">
          <h2 class="section-heading__title">On the way</h2>
          <span class="section-heading__aside">nearest first, training included</span>
        </div>
        <GoalList v-if="onTheWay.length" :rows="onTheWay" />
        <p v-else class="note">Nothing else is left.</p>
        <p v-if="furtherOff" class="note quest-goals__further">{{ furtherOff }}</p>
      </section>

      <section>
        <div class="section-heading section-heading--first">
          <h2 class="section-heading__title">Done</h2>
          <span class="section-heading__aside">
            {{ groups.done.length }} of {{ goalCount }} goals
          </span>
        </div>
        <!-- named a list outright: some browsers stop announcing one once its markers are styled away -->
        <ul v-if="groups.done.length" class="quest-goals__done" role="list">
          <li
            v-for="(standing, index) in groups.done"
            :key="standing.goal.id"
            class="quest-goals__done-row"
            :class="{ 'quest-goals__done-row--banded': index % 2 === 0 }"
          >
            <span>{{ standing.goal.name }}</span>
            <GameNumber tone="due">Done</GameNumber>
          </li>
        </ul>
        <p v-else class="note">None yet.</p>
      </section>
    </div>
  </div>
</template>

<style lang="scss">
.quest-goals {
  &__top {
    display: grid;
    grid-template-columns: 500px minmax(0, 1fr);
    align-items: start;
    gap: 48px;
  }

  &__bottom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 440px;
    align-items: start;
    gap: 48px;
    margin-top: 34px;
  }

  &__further {
    margin-top: 10px;
  }

  &__done {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__done-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-radius: var(--radius);
    color: var(--color-text);
    font-weight: 600;

    &--banded {
      background: var(--color-slot);
    }
  }

  @media (max-width: 1100px) {
    &__top,
    &__bottom {
      grid-template-columns: minmax(0, 1fr);
      gap: 32px;
    }
  }
}
</style>

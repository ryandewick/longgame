<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'

/**
 * The Skills table: one row per skill, each a line from 1 to 99 with what is left of it. A row
 * opens its skill's detail under the table; the whole row takes the click, and the skill's name
 * is the button a keyboard and a screen reader use.
 *
 * It only draws the rows it is handed, in the order given.
 */
const { rows, selectedSkill = null } = defineProps<{
  rows: readonly SkillRow[]
  /** The skill whose detail is open, if any. */
  selectedSkill?: SkillKey | null
}>()

const emit = defineEmits<{
  /** A row was picked: to open its detail, or to close it when it is the one already open. */
  select: [skill: SkillKey]
}>()
</script>

<template>
  <table class="data-table skills-table">
    <thead>
      <tr>
        <th class="data-table__heading skills-table__heading" scope="col">
          <span class="visually-hidden">Icon</span>
        </th>
        <th class="data-table__heading skills-table__heading" scope="col">Skill</th>
        <th
          class="data-table__heading data-table__heading--number skills-table__heading"
          scope="col"
        >
          Level
        </th>
        <th class="data-table__heading skills-table__heading" scope="col">
          <span class="skills-table__heading-text">1 to 99, with a stop at each method unlock</span>
        </th>
        <th
          class="data-table__heading data-table__heading--number skills-table__heading skills-table__heading--to-max"
          scope="col"
        >
          To 99
        </th>
        <th
          class="data-table__heading data-table__heading--number skills-table__heading skills-table__heading--time-left"
          scope="col"
        >
          Time left
        </th>
        <th
          class="data-table__heading skills-table__heading skills-table__heading--best-now"
          scope="col"
        >
          Best now
        </th>
      </tr>
    </thead>
    <tbody>
      <!-- the button inside the row is what a keyboard presses; its click arrives here too -->
      <tr
        v-for="(row, index) in rows"
        :key="row.skill"
        class="data-table__row skills-table__row"
        :class="{
          'data-table__row--banded': index % 2 === 1,
          'data-table__row--selected': row.skill === selectedSkill,
          'skills-table__row--selected': row.skill === selectedSkill,
          'skills-table__row--maxed': row.isMaxed,
        }"
        @click="emit('select', row.skill)"
      >
        <td class="data-table__cell data-table__cell--icon skills-table__cell">
          <SkillIcon :skill="row.skill" />
        </td>
        <td class="data-table__cell skills-table__cell">
          <button
            type="button"
            class="skills-table__name"
            :class="{ 'skills-table__name--maxed': row.isMaxed }"
            :aria-expanded="row.skill === selectedSkill"
          >
            {{ row.name }}
          </button>
          <span v-if="row.pace" class="data-table__detail">{{ row.pace }}</span>
        </td>
        <td class="data-table__cell data-table__cell--number skills-table__cell">
          <GameNumber>{{ row.level }}</GameNumber>
        </td>
        <td class="data-table__cell skills-table__cell skills-table__cell--strip">
          <SkillStrip :skill="row.skill" :level="row.level" :method-levels="row.methodLevels" />
        </td>
        <td
          class="data-table__cell data-table__cell--number skills-table__cell skills-table__cell--to-max"
        >
          {{ row.toMax }}
        </td>
        <td
          class="data-table__cell data-table__cell--number skills-table__cell skills-table__cell--time-left"
        >
          {{ row.timeLeft }}
        </td>
        <td class="data-table__cell skills-table__cell skills-table__cell--best-now">
          {{ row.bestNow }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style lang="scss">
.skills-table {
  &__row {
    cursor: pointer;
  }

  // the row lifts under the pointer; the open row keeps its own colour
  &__row:hover &__cell {
    background: var(--color-raised);
  }

  &__row--selected:hover &__cell {
    background: var(--color-selected);
  }

  // a finished skill steps back: there is nothing left to plan for it
  &__row--maxed &__cell {
    color: var(--color-text-faint);
  }

  &__name {
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-text-strong);
    font: 700 16px/1.25 var(--font-text);
    text-align: left;
    cursor: pointer;

    &--maxed {
      color: var(--color-text-muted);
    }
  }

  &__cell {
    &--strip {
      width: 36%;
      min-width: 150px;
    }

    &--best-now {
      color: var(--color-text-muted);
      font-size: 13px;
    }
  }

  // Narrower windows drop the columns the detail repeats: first the method, then the figures.
  @media (max-width: 1000px) {
    &__heading--best-now,
    &__cell--best-now {
      display: none;
    }
  }

  @media (max-width: 760px) {
    // the one long heading may break over the narrow strip column
    &__heading-text {
      white-space: normal;
    }

    &__heading--to-max,
    &__heading--time-left,
    &__cell--to-max,
    &__cell--time-left {
      display: none;
    }

    &__cell--strip {
      min-width: 96px;
    }
  }
}
</style>

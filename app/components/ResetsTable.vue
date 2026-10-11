<script setup lang="ts">
/**
 * The timed runs and dailies, one to a row: what it is, how often it comes round, whether it is
 * due, and a button to log it as done now. A reset the account cannot do yet is dimmed, says
 * what it needs and has no button.
 */
defineProps<{
  rows: readonly ResetsTableRow[]
}>()

const emit = defineEmits<{
  /** The player has just done this reset. */
  done: [resetKey: string]
}>()
</script>

<template>
  <table class="data-table">
    <thead>
      <tr>
        <th class="data-table__heading" scope="col"><span class="visually-hidden">Icon</span></th>
        <th class="data-table__heading" scope="col">Reset</th>
        <th class="data-table__heading" scope="col">Every</th>
        <th class="data-table__heading" scope="col">Status</th>
        <th class="data-table__heading" scope="col">
          <span class="visually-hidden">Mark done</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(row, index) in rows"
        :key="row.key"
        class="data-table__row"
        :class="{
          'data-table__row--banded': index % 2 === 1,
          'data-table__row--locked': row.needs !== null,
        }"
      >
        <td class="data-table__cell data-table__cell--top data-table__cell--icon">
          <SkillIcon :skill="row.skill" :faded="row.needs !== null" />
        </td>
        <td class="data-table__cell data-table__cell--top">
          <b class="data-table__title">{{ row.name }}</b>
          <span class="data-table__detail">
            {{ row.note }}
            <em v-if="row.needs !== null" class="data-table__needs">Needs {{ row.needs }}.</em>
          </span>
        </td>
        <td class="data-table__cell data-table__cell--top data-table__cell--nowrap">
          {{ row.every }}
        </td>
        <td class="data-table__cell data-table__cell--top data-table__cell--nowrap">
          <span v-if="row.needs !== null" class="tag">Locked</span>
          <template v-else>
            <GameNumber v-if="row.isDue" tone="due">Due</GameNumber>
            {{ row.status }}
          </template>
        </td>
        <td class="data-table__cell data-table__cell--top data-table__cell--actions">
          <button
            v-if="row.needs === null"
            type="button"
            class="button button--small"
            :aria-label="`Done now: ${row.name}`"
            @click="emit('done', row.key)"
          >
            Done now
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

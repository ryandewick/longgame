<script setup lang="ts">
import type { MethodOption } from '#shared/domain/methods'

/**
 * Every method of one skill, lowest level first: what it is, what the account still needs for
 * it, its rate, how much attention it takes and what it costs to keep going. Methods the account
 * cannot use yet are dimmed; the one the lists call best is marked.
 */
const { methods, bestMethod = null } = defineProps<{
  /** The skill's methods as the account sees them, in the order to list them. */
  methods: readonly MethodOption[]
  /** The method to mark "Best now"; null when the skill has none open. */
  bestMethod?: MethodOption | null
  /** An ironman is told whose supplies a method runs on; a main is told what it costs. */
  isIronman?: boolean
}>()

const isBest = (option: MethodOption): boolean => option.method === bestMethod?.method
</script>

<template>
  <div class="data-table__scroller">
    <table class="data-table methods-table">
      <thead>
        <tr>
          <th class="data-table__heading data-table__heading--number" scope="col">Level</th>
          <th class="data-table__heading" scope="col">Method</th>
          <th class="data-table__heading data-table__heading--number" scope="col">Rate</th>
          <th class="data-table__heading" scope="col">Pace</th>
          <th class="data-table__heading" scope="col">{{ isIronman ? 'Supplies' : 'Cost' }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(option, index) in methods"
          :key="`${option.method.level} ${option.method.name}`"
          class="data-table__row"
          :class="{
            'data-table__row--banded': index % 2 === 1,
            'data-table__row--selected': isBest(option),
            'data-table__row--locked': !option.unlocked,
          }"
        >
          <td class="data-table__cell data-table__cell--top data-table__cell--number">
            <span class="methods-table__level">{{ option.method.level }}</span>
          </td>
          <td class="data-table__cell data-table__cell--top">
            <b class="data-table__title">{{ option.method.name }}</b>
            <span v-if="isBest(option)" class="tag methods-table__tag">Best now</span>
            <span v-if="option.method.timedRun" class="tag methods-table__tag">Run</span>
            <span v-if="option.method.tickPerfect" class="tag methods-table__tag">
              Tick-perfect
            </span>
            <span class="data-table__detail">
              {{ option.method.note }}
              <em v-if="option.missing.length" class="data-table__needs">
                {{ methodNeedsText(option) }}
              </em>
            </span>
          </td>
          <td class="data-table__cell data-table__cell--top data-table__cell--number">
            {{ methodRateText(option) }}
          </td>
          <td class="data-table__cell data-table__cell--top">
            <AttentionMark :intensity="option.method.intensity" />
          </td>
          <td class="data-table__cell data-table__cell--top data-table__cell--nowrap">
            {{ methodSuppliesText(option.method, isIronman) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss">
.methods-table {
  &__level {
    font-weight: 800;
  }

  // a tag sits on the method's name line, lifted to the middle of the taller name
  &__tag {
    margin-left: 8px;
    vertical-align: 2px;
  }
}
</style>

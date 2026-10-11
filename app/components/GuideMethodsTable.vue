<script setup lang="ts">
import { skillName } from '#shared/data/skills'
import { guidePath, type GuideMethod } from '#shared/domain/guides'

/**
 * A guide's table of training methods: the level each opens at, its name and note, what it
 * needs, the XP it gives, how much attention it takes and who it is for.
 *
 * What a method needs is stated as a plain fact here. The red "Needs" of the planner means "your
 * account lacks this", which a page with no account cannot say.
 */
defineProps<{
  methods: readonly GuideMethod[]
  /** Lead each row with its skill, as a link to that skill's guide: for a table that spans skills. */
  showSkill?: boolean
}>()
</script>

<template>
  <div class="data-table__scroller">
    <table class="data-table guide-methods-table">
      <thead>
        <tr>
          <th v-if="showSkill" class="data-table__heading" scope="col">Skill</th>
          <th class="data-table__heading data-table__heading--number" scope="col">Level</th>
          <th class="data-table__heading" scope="col">Method</th>
          <th class="data-table__heading data-table__heading--number" scope="col">XP</th>
          <th class="data-table__heading" scope="col">Attention</th>
          <th class="data-table__heading" scope="col">For</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(method, index) in methods"
          :key="`${method.skill} ${method.level} ${method.name}`"
          class="data-table__row"
          :class="{ 'data-table__row--banded': index % 2 === 1 }"
        >
          <td
            v-if="showSkill"
            class="data-table__cell data-table__cell--top data-table__cell--nowrap"
          >
            <NuxtLink :to="guidePath(method.skill)">{{ skillName(method.skill) }}</NuxtLink>
          </td>
          <td class="data-table__cell data-table__cell--top data-table__cell--number">
            <span class="guide-methods-table__level">{{ method.level }}</span>
          </td>
          <th
            class="data-table__cell data-table__cell--top guide-methods-table__method"
            scope="row"
          >
            <span class="data-table__title">{{ method.name }}</span>
            <span v-if="method.isTimedRun" class="tag guide-methods-table__tag">Timed run</span>
            <span class="data-table__detail">
              {{ method.note }}
              <span v-if="method.needs" class="guide-methods-table__needs">
                Needs {{ method.needs }}.
              </span>
            </span>
          </th>
          <td class="data-table__cell data-table__cell--top data-table__cell--number">
            <span class="guide-methods-table__rate">{{ method.rate }}</span>
          </td>
          <td class="data-table__cell data-table__cell--top">
            <AttentionMark :intensity="method.intensity" />
          </td>
          <td class="data-table__cell data-table__cell--top data-table__cell--nowrap">
            {{ method.audience }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss">
.guide-methods-table {
  &__level {
    font-weight: 800;
  }

  // the method names its row, so its cell is a row header that reads like any other cell
  &__method {
    font-weight: 400;
    text-align: left;
  }

  &__tag {
    margin-left: 8px;
    vertical-align: 2px;
  }

  &__needs {
    color: var(--color-text-faint);
  }

  // Phones: the level, the method and its rate fit the screen, with the note at a width that reads;
  // the last columns are a sideways scroll away (the table sits in a scroller).
  @media (max-width: 760px) {
    &__method {
      min-width: 200px;
    }

    &__rate {
      display: inline-block;
      width: 76px;
      white-space: normal;
    }
  }
}
</style>

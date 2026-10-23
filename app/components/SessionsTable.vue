<script setup lang="ts">
import type { HistoryEntry } from '#shared/types/session'
import { formatClock, formatShortNumber } from '#shared/domain/format'

/**
 * The finished sessions, in the order given (the history keeps the newest first): the day, an
 * icon for each block, the time logged, the XP gained and the levels that came with it.
 */
const { entries } = defineProps<{
  entries: readonly HistoryEntry[]
}>()

const rows = computed(() =>
  entries.map((entry, index) => ({
    // two sessions cannot end in the same millisecond
    key: entry.endedAt,
    date: formatSessionDate(entry.endedAt),
    blocks: entry.blocks.map((block) => ({
      skill: historyBlockSkill(block),
      listIcon: blockListIcon(block),
      isWildcard: block.kind === 'wildcard',
      description: describeHistoryBlock(block),
    })),
    // the icons only show their names as tooltips, so the row of them is named as one picture
    blocksLabel: entry.blocks.map(describeHistoryBlock).join(', '),
    logged: formatClock(entry.elapsed),
    gained: entry.totalXp ? `+${formatShortNumber(entry.totalXp)}` : '',
    levels: describeLevelsGained(entry.levels),
    isBanded: index % 2 === 1,
  })),
)
</script>

<template>
  <div class="data-table__scroller">
    <table class="data-table sessions-table">
      <thead>
        <tr>
          <th class="data-table__heading" scope="col">When</th>
          <th class="data-table__heading" scope="col">Blocks</th>
          <th class="data-table__heading data-table__heading--number" scope="col">Logged</th>
          <th class="data-table__heading data-table__heading--number" scope="col">Gained</th>
          <th class="data-table__heading" scope="col">Levels</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.key"
          class="data-table__row"
          :class="{ 'data-table__row--banded': row.isBanded }"
        >
          <td class="data-table__cell data-table__cell--nowrap">{{ row.date }}</td>
          <td class="data-table__cell">
            <span class="sessions-table__blocks" role="img" :aria-label="row.blocksLabel">
              <SkillIcon
                v-for="(block, place) in row.blocks"
                :key="place"
                :skill="block.skill"
                :list-icon="block.listIcon"
                :wildcard="block.isWildcard"
                :title="block.description"
              />
            </span>
          </td>
          <td class="data-table__cell data-table__cell--number">{{ row.logged }}</td>
          <td class="data-table__cell data-table__cell--number">
            <GameNumber v-if="row.gained">{{ row.gained }}</GameNumber>
            <template v-else>none yet</template>
          </td>
          <td class="data-table__cell">{{ row.levels }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss">
.sessions-table {
  // a session's blocks, an icon each, in the order they were dealt
  &__blocks {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
}
</style>

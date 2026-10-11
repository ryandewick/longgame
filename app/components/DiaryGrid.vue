<script setup lang="ts">
import { DIARY_REGIONS, DIARY_TIERS } from '#shared/data/diaries'

/**
 * The achievement diaries as a grid: a row for each region, a tick box for each of its four tiers.
 */
const { completed } = defineProps<{
  /** The tiers that count as done, each as region and tier: 'Ardougne Medium'. */
  completed: ReadonlySet<string>
}>()

const emit = defineEmits<{
  /** The player ticked this tier ('Ardougne Medium'), or unticked it. */
  toggle: [diary: string]
}>()

const rows = computed(() =>
  DIARY_REGIONS.map((region, index) => ({
    region,
    isBanded: index % 2 === 1,
    tiers: DIARY_TIERS.map((tier) => {
      const diary = `${region} ${tier}`
      return { diary, done: completed.has(diary) }
    }),
  })),
)
</script>

<template>
  <table class="data-table diary-grid">
    <thead>
      <tr>
        <th class="data-table__heading" scope="col">Region</th>
        <th v-for="tier in DIARY_TIERS" :key="tier" class="data-table__heading" scope="col">
          <span class="diary-grid__tier-name">{{ tier }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.region"
        class="data-table__row"
        :class="{ 'data-table__row--banded': row.isBanded }"
      >
        <td class="data-table__cell">
          <b class="data-table__title">{{ row.region }}</b>
        </td>
        <td v-for="tier in row.tiers" :key="tier.diary" class="data-table__cell diary-grid__tier">
          <TickBox
            :ticked="tier.done"
            :label="`${tier.diary}, ${tier.done ? 'done' : 'not done'}`"
            @toggle="emit('toggle', tier.diary)"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style lang="scss">
.diary-grid {
  // the four tier columns are narrow and centred under their names
  &__tier {
    width: 72px;
    text-align: center;
  }

  &__tier-name {
    display: block;
    text-align: center;
  }

  @media (max-width: 760px) {
    &__tier {
      width: 52px;
    }
  }
}
</style>

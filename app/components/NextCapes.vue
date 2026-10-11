<script setup lang="ts">
import { skillName } from '#shared/data/skills'
import { capeFillPercent } from '#shared/domain/capes'

/**
 * The three capes nearest to being earned, nearest first: each as a small cape filled as far as
 * its level, with the hours of grinding (or days of runs) still to go.
 */
const account = useAccountStore()

const capes = computed(() =>
  closestCapes(account.skillInsights).map((outlook) => ({
    skill: outlook.skill,
    level: outlook.stat.level,
    distance: capeDistance(outlook),
  })),
)
</script>

<template>
  <!-- an account with every cape has no next one -->
  <section v-if="capes.length" class="next-capes">
    <div class="section-heading section-heading--first">
      <h3 class="section-heading__title">Next capes</h3>
      <span class="section-heading__aside">closest first</span>
    </div>

    <RowList :items="capes" :item-key="(cape) => cape.skill">
      <template #lead="{ item: cape }">
        <span class="next-capes__cape">
          <CapeImage :skill="cape.skill" :fill="capeFillPercent(cape.level)" />
        </span>
      </template>
      <template #default="{ item: cape }">{{ skillName(cape.skill) }} {{ cape.level }}</template>
      <template #trail="{ item: cape }">
        <GameNumber>{{ cape.distance.figure }}</GameNumber>
        <small class="next-capes__unit">{{ cape.distance.unit }}</small>
      </template>
    </RowList>
  </section>
</template>

<style lang="scss">
.next-capes {
  &__cape {
    flex: none;
    width: 24px;
  }

  // the unit belongs to the figure before it, so it sits closer than the row's other gaps
  &__unit {
    margin-left: -4px;
    color: var(--color-text-faint);
    font-size: 13px;
  }
}
</style>

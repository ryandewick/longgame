<script setup lang="ts">
/**
 * The two capes no skill gives, on a rail of their own: the quest point cape and the achievement
 * diary cape, each filled from the hem as far as the account has got, with its count in the
 * game's numbers.
 */
const { counts } = defineProps<{
  counts: CapeCounts
}>()

const capes = computed(() => [
  {
    key: 'quest-point',
    src: milestoneCapeUrl('quest-point'),
    fill: (100 * counts.questPoints) / counts.questPointsTotal,
    count: counts.questPoints,
    total: counts.questPointsTotal,
    label: 'quest points, for the quest point cape',
  },
  {
    key: 'achievement-diary',
    src: milestoneCapeUrl('achievement-diary'),
    fill: (100 * counts.tiers) / counts.tiersTotal,
    count: counts.tiers,
    total: counts.tiersTotal,
    label: 'diary tiers, for the achievement diary cape',
  },
])
</script>

<template>
  <section class="goal-capes" aria-label="The quest point cape and the achievement diary cape">
    <div class="goal-capes__rail">
      <div v-for="cape in capes" :key="cape.key" class="goal-capes__cape">
        <CapeImage class="goal-capes__picture" :skill="null" :src="cape.src" :fill="cape.fill" />
        <span class="goal-capes__count">
          <GameNumber size="headline">{{ cape.count }}</GameNumber>
          <GameNumber tone="white">of {{ cape.total }}</GameNumber>
        </span>
        <span class="goal-capes__label">{{ cape.label }}</span>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.goal-capes {
  position: relative;
  overflow: hidden;
  padding: 22px 26px 24px;
  border-radius: var(--radius);
  background: radial-gradient(
    120% 140% at 50% -20%,
    var(--color-stage-glow) 0,
    var(--color-stage-falloff) 45%,
    var(--color-stage) 80%
  );
  box-shadow: 0 0 0 1px var(--color-black);

  &__rail {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding: 0 6px;

    // the brass rail the two capes hang from, as on the rack
    &::before {
      position: absolute;
      top: 6px;
      right: -26px;
      left: -26px;
      height: 6px;
      background: linear-gradient(
        var(--color-brass-light),
        var(--color-brass) 45%,
        var(--color-brass-dark)
      );
      box-shadow: var(--shadow-rail);
      content: '';
    }
  }

  &__cape {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  &__picture {
    width: 136px;
  }

  &__count {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 18px;
  }

  &__label {
    margin-top: 8px;
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.35;
  }
}
</style>

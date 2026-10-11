<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'

/**
 * Three skillcapes fanned out from one hanger, the last on top: the picture for a panel that is
 * about the whole account rather than one skill. It fills whatever holds it, which has to be a
 * positioned box (`position: relative`).
 */
defineProps<{
  /** Up to three, and the same skill may come twice (a session of two farm runs): fewer simply fan less. */
  skills: readonly SkillKey[]
}>()
</script>

<template>
  <span class="cape-fan">
    <img
      v-for="(skill, place) in skills"
      :key="place"
      class="cape-fan__cape"
      :style="{ '--cape-fan-place': place }"
      :src="capeImageUrl(skill)"
      alt=""
    />
  </span>
</template>

<style lang="scss">
.cape-fan {
  position: absolute;
  inset: 0;

  &__cape {
    position: absolute;
    top: calc(50% - 108px);
    left: calc(50% - 52px);
    width: 104px;
    // turned about the hanger at the top: the middle cape hangs straight, the others 8 degrees either side
    transform: rotate(calc((var(--cape-fan-place) - 1) * 8deg));
    transform-origin: 50% 4%;
    filter: drop-shadow(var(--shadow-cape-hanging));
  }

  @media (max-width: 760px) {
    &__cape {
      top: 6px;
      left: calc(50% - 38px);
      width: 76px;
    }
  }
}
</style>

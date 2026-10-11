<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'

/**
 * One thing the planner does, said in a heading and a sentence or two, beside a small skillcape
 * part-filled with colour: the product's own picture of progress, as a bullet. One that is below
 * the window when the page opens eases in as it is scrolled to, and its cape fills as it arrives.
 */
defineProps<{
  title: string
  text: string
  /** The cape beside the words; null for the max cape. */
  cape: SkillKey | null
  /** How much of the cape is in colour, 0 to 100. */
  fill: number
}>()

const vReveal = useReveal()
const capeImage = useTemplateRef('capeImage')

function fillCape(): void {
  capeImage.value?.fillFrom(0, { duration: 1.1, delay: 0.15 })
}
</script>

<template>
  <div v-reveal="fillCape" class="landing-feature">
    <span class="landing-feature__cape">
      <CapeImage ref="capeImage" :skill="cape" :fill="fill" />
    </span>
    <div>
      <h3 class="landing-feature__title">{{ title }}</h3>
      <p class="landing-feature__text">{{ text }}</p>
    </div>
  </div>
</template>

<style lang="scss">
.landing-feature {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  align-items: start;
  gap: 18px;

  &__cape {
    display: block;
  }

  &__title {
    margin-bottom: 4px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0;
  }

  &__text {
    max-width: 62ch;
    color: var(--color-text-muted);
  }
}
</style>

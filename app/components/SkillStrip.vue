<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { readableCapeColour } from '#shared/domain/capes'

/**
 * A skill as a line from 1 to 99: filled in the skill's cape colour as far as its level, with a
 * stop at every level a method unlocks and a white marker where the skill stands. To a screen
 * reader it is one picture that says the level and how many unlocks are still ahead.
 */
const { skill, level, methodLevels } = defineProps<{
  skill: SkillKey
  level: number
  /** The level each of the skill's methods opens at. Repeats and the two ends are left out. */
  methodLevels: readonly number[]
}>()

const strip = computed(() => skillStrip(level, methodLevels))
</script>

<template>
  <div
    class="skill-strip"
    role="img"
    :aria-label="strip.label"
    :style="{ '--skill-strip-colour': readableCapeColour(skill) }"
  >
    <span class="skill-strip__fill" :style="{ width: `${strip.position}%` }" />
    <span
      v-for="stop in strip.stops"
      :key="stop.level"
      class="skill-strip__stop"
      :class="{ 'skill-strip__stop--reached': stop.reached }"
      :style="{ left: `${stop.position}%` }"
    />
    <span class="skill-strip__marker" :style="{ left: `${strip.position}%` }" />
  </div>
</template>

<style lang="scss">
.skill-strip {
  position: relative;
  height: 16px;

  // the whole road from 1 to 99, under the part already travelled
  &::before {
    content: '';
    position: absolute;
    top: 7px;
    right: 0;
    left: 0;
    height: 2px;
    background: var(--color-edge-strong);
  }

  &__fill {
    position: absolute;
    top: 5px;
    left: 0;
    height: 6px;
    border-radius: 3px;
    background: var(--skill-strip-colour);
  }

  // a ring punched out of the line, so a stop reads on the filled part and on the empty part
  &__stop {
    position: absolute;
    top: 4px;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border: 2px solid var(--color-edge-strong);
    border-radius: 50%;
    background: var(--color-ground);

    &--reached {
      border-color: var(--skill-strip-colour);
    }
  }

  &__marker {
    position: absolute;
    top: 0;
    width: 4px;
    height: 16px;
    margin-left: -2px;
    border-radius: 2px;
    background: var(--color-text-strong);
  }
}
</style>

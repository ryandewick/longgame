<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { readableCapeColour } from '#shared/domain/capes'

/**
 * The game's XP bar: a dark well framed in black, filled as far as the skill is through its
 * level, in the skill's cape colour lightened until it reads on the dark ground. It is a
 * picture of a figure that is always written out beside it, so screen readers skip it.
 */
const { skill, percent } = defineProps<{
  skill: SkillKey
  /** How far through the level, 0 to 100. */
  percent: number
}>()

const fillWidth = computed(() => `${Math.min(100, Math.max(0, percent)).toFixed(1)}%`)
const fillColour = computed(() => readableCapeColour(skill))
</script>

<template>
  <span
    class="xp-bar"
    :style="{ '--xp-bar-width': fillWidth, '--xp-bar-colour': fillColour }"
    aria-hidden="true"
  >
    <span class="xp-bar__fill" />
  </span>
</template>

<style lang="scss">
.xp-bar {
  position: relative;
  display: block;
  height: 16px;
  background: var(--color-well);
  // the game's frame: a black line, then an edge line outside it
  box-shadow:
    0 0 0 1px var(--color-black),
    0 0 0 2px var(--color-edge);

  &__fill {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--xp-bar-width);
    background: var(--xp-bar-colour);
    // a faint shine along the top, as the game draws it
    box-shadow: inset 0 2px 0 color-mix(in srgb, var(--color-text-strong) 18%, transparent);
  }
}
</style>

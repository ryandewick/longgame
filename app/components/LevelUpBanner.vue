<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { skillName } from '#shared/data/skills'

/**
 * A level gained, said the way the game says it: the parchment dialog with the game's own
 * sentence. Borrowed from the game for this and for toasts, and for nothing else.
 */
const {
  skill,
  level,
  moreCount = 0,
} = defineProps<{
  skill: SkillKey
  /** The level the skill is now. */
  level: number
  /** How many other skills gained a level in the same session. */
  moreCount?: number
}>()

const name = computed(() => skillName(skill))
// "an Attack level", "a Ranged level"
const article = computed(() => (/^[AEIOU]/.test(name.value) ? 'an' : 'a'))
</script>

<template>
  <div class="level-up-banner">
    <SkillIcon :skill="skill" />
    <span>
      Congratulations, you just advanced {{ article }} {{ name }} level.<br />
      Your {{ name }} level is now {{ level }}.
      <template v-if="moreCount > 0">And {{ moreCount }} more.</template>
    </span>
  </div>
</template>

<style lang="scss">
.level-up-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 5px;
  border: 2px solid var(--color-parchment-edge);
  outline: 1px solid var(--color-parchment-outline);
  background: var(--color-parchment);
  color: var(--color-parchment-ink);
  font: 16px/1.1 var(--font-game);
  -webkit-font-smoothing: none;
}
</style>

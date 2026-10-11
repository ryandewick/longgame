<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { capeColours } from '#shared/domain/capes'
import { MAX_LEVEL } from '#shared/domain/xp'

/**
 * A skill's crest: its cape hung on a field of the cape's own colour, edged with the cape's
 * trim, with the skill's level set large in the corner. The cape is the trimmed one at 99.
 */
const { skill, level } = defineProps<{
  skill: SkillKey
  level: number
}>()

const colours = computed(() => capeColours(skill))
</script>

<template>
  <div
    class="skill-crest"
    :style="{ '--skill-crest-cape': colours.cape, '--skill-crest-trim': colours.trim }"
  >
    <img class="skill-crest__cape" :src="capeImageUrl(skill, level >= MAX_LEVEL)" alt="" />
    <GameNumber class="skill-crest__level" size="clock">
      <span class="visually-hidden">Level </span>{{ level }}
    </GameNumber>
  </div>
</template>

<style lang="scss">
.skill-crest {
  position: relative;
  height: 206px;
  overflow: hidden;
  border-bottom: 10px solid var(--skill-crest-trim);
  border-radius: var(--radius);
  background: var(--skill-crest-cape);

  &__cape {
    position: absolute;
    top: 10px;
    left: 22px;
    width: 96px;
    filter: drop-shadow(var(--shadow-cape-hanging));
  }

  &__level {
    position: absolute;
    right: 20px;
    bottom: 14px;
  }
}
</style>

<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'

/**
 * A skillcape showing progress: the same picture twice in one box, greyed out underneath and in
 * colour on top, with the coloured copy cut off above `fill`, so colour rises from the hem as
 * the skill climbs. It is as wide as whatever holds it.
 */
const { skill, fill } = defineProps<{
  /** The skill whose cape this is; null for the max cape. */
  skill: SkillKey | null
  /** How much of the cape is in colour, 0 to 100. */
  fill: number
  /** Draw the trimmed cape: the one worn at 99. */
  trimmed?: boolean
}>()

const clampedFill = computed(() => Math.min(100, Math.max(0, fill)).toFixed(2))

/** How much of `fill` is showing, 0 to 1. Only set while the cape is filling: at rest it is all of it. */
const FILL_PROGRESS = '--cape-image-fill-progress'

const picture = useTemplateRef('picture')
const motion = useMotion()

/**
 * Lets the colour rise from `fromShare` of the cape's fill (0 is an empty cape) to all of it.
 * Whoever hangs the cape says when: the rail on the first load and at the tally, a landing
 * feature as it is scrolled to. `fill` itself is never touched, so a new level arriving while the
 * colour rises is not lost.
 */
function fillFrom(fromShare: number, timing: { duration: number; delay: number }): void {
  const element = picture.value
  if (!element) return
  motion.play((tweens) => {
    tweens.fromTo(
      element,
      { [FILL_PROGRESS]: fromShare },
      {
        [FILL_PROGRESS]: 1,
        ...timing,
        ease: 'power2.out',
        // a fill already on its way gives way to this one
        overwrite: true,
        clearProps: FILL_PROGRESS,
      },
    )
  })
}

defineExpose({ fillFrom })
</script>

<template>
  <span ref="picture" class="cape-image" :style="{ '--cape-image-fill': `${clampedFill}%` }">
    <img
      class="cape-image__layer cape-image__layer--greyed"
      :src="capeImageUrl(skill, trimmed)"
      alt=""
    />
    <img
      class="cape-image__layer cape-image__layer--coloured"
      :src="capeImageUrl(skill, trimmed)"
      alt=""
    />
  </span>
</template>

<style lang="scss">
.cape-image {
  position: relative;
  display: block;
  // the cape renders are all 320 by 622
  aspect-ratio: 320 / 622;

  &__layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    &--greyed {
      filter: brightness(0.34) saturate(0.12);
    }

    // cut off above the fill, or above as much of the fill as has risen so far (see `fillFrom`)
    &--coloured {
      clip-path: inset(
        calc(100% - var(--cape-image-fill) * var(--cape-image-fill-progress, 1)) 0 0 0
      );
    }
  }
}
</style>

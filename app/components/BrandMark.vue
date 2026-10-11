<script setup lang="ts">
/**
 * The brand: the yellow tile with the ring-and-tail mark, and the wordmark "long game" with both
 * g's swapped for 9s. The ring fills with the account's progress to max, and the favicon is kept
 * in step with it, so every player's icon is their own.
 *
 * It is decoration: whatever holds it (a link, a labelled span) gives it its name.
 */
const { progress = BRAND_MARK_RESTING_PROGRESS } = defineProps<{
  /** Progress to max, 0 to 1. Left out, the mark rests at three quarters. */
  progress?: number
}>()

const fillPath = computed(() => brandMarkFillPath(progress))
const isComplete = computed(() => isBrandMarkComplete(progress))

useHead({
  link: [
    {
      key: 'favicon',
      rel: 'icon',
      type: 'image/svg+xml',
      href: () => brandMarkFaviconUrl(progress),
    },
  ],
})
</script>

<template>
  <span class="brand-mark">
    <span class="brand-mark__tile">
      <svg
        class="brand-mark__icon"
        viewBox="0 0 64 64"
        fill="none"
        :stroke-width="BRAND_MARK_RING.strokeWidth"
        aria-hidden="true"
      >
        <circle
          class="brand-mark__stroke"
          :cx="BRAND_MARK_RING.centreX"
          :cy="BRAND_MARK_RING.centreY"
          :r="BRAND_MARK_RING.radius"
        />
        <path
          class="brand-mark__stroke"
          :class="{ 'brand-mark__stroke--filled': isComplete }"
          :d="BRAND_MARK_TAIL"
        />
        <path v-if="fillPath" class="brand-mark__stroke brand-mark__stroke--filled" :d="fillPath" />
      </svg>
    </span>
    <span class="brand-mark__wordmark" aria-hidden="true">
      lon<span class="brand-mark__nine">9</span> <span class="brand-mark__nine">9</span>ame
    </span>
  </span>
</template>

<style lang="scss">
.brand-mark {
  display: flex;
  align-items: center;
  gap: 11px;

  &__tile {
    display: grid;
    flex: none;
    place-items: center;
    width: 36px;
    height: 36px;
    // the app-icon shape, which the favicon repeats
    border-radius: 22%;
    background: var(--color-stat);
  }

  &__icon {
    display: block;
    width: 80%;
    height: 80%;
  }

  &__stroke {
    stroke: var(--color-stat-unfilled);

    &--filled {
      stroke: var(--color-ink);
    }
  }

  &__wordmark {
    // room below the baseline for the 9s, which sit low like the g's they stand in for
    padding-bottom: 0.2em;
    color: var(--color-text);
    font: 800 27px/1 var(--font-wordmark);
    letter-spacing: -0.045em;
    white-space: nowrap;
  }

  // Poppins draws lining figures, so each 9 is dropped to descend like a g.
  &__nine {
    position: relative;
    top: 0.215em;
    display: inline-block;
    color: var(--color-stat);
  }
}
</style>

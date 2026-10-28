<script setup lang="ts">
/**
 * The brand: the wordmark "long game" with both g's swapped for yellow 9s, the hidden 99. It
 * stands alone: the 99 icon (app/utils/brand-mark.ts) is only for places that need a square, so
 * two 99s never sit side by side.
 *
 * It is decoration: whatever holds it (a link, a labelled span) gives it its name.
 */
</script>

<template>
  <span class="brand-mark" aria-hidden="true">
    lon<span class="brand-mark__nine">9</span> <span class="brand-mark__nine">9</span>ame
  </span>
</template>

<style lang="scss">
.brand-mark {
  display: block;
  // room below the baseline for the 9s, which sit low like the g's they stand in for
  padding-bottom: 0.2em;
  color: var(--color-text);
  font: 800 27px/1 var(--font-wordmark);
  letter-spacing: -0.045em;
  white-space: nowrap;

  // Poppins draws lining figures, so each 9 is dropped to descend like a g.
  &__nine {
    position: relative;
    top: 0.215em;
    display: inline-block;
    color: var(--color-stat);
  }
}
</style>

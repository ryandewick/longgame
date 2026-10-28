<script setup lang="ts">
/**
 * The band the rack hangs in: a dark stage lit from above, running the full width of the page
 * under the header, with a heading row and then whatever hangs below it (the rail).
 *
 * Slots: `title` is the band's heading, `default` follows it on the same row (a summary, a
 * button), and `rail` is the rail itself.
 */
defineProps<{
  /** The band's name for screen readers, when its heading alone would not say what it is. */
  label?: string
  /** Let a long heading run onto a second line. A count ("1/24 capes") never should. */
  wrapTitle?: boolean
}>()
</script>

<template>
  <section class="rack-stage" :aria-label="label">
    <div class="page-width">
      <div class="rack-stage__top">
        <h1 class="rack-stage__title" :class="{ 'rack-stage__title--wrapping': wrapTitle }">
          <slot name="title" />
        </h1>
        <slot />
      </div>
      <slot name="rail" />
    </div>
  </section>
</template>

<style lang="scss">
.rack-stage {
  padding: 18px 0 14px;
  overflow: hidden;
  border-top: 1px solid var(--color-black);
  border-bottom: 1px solid var(--color-black);
  background: radial-gradient(
    120% 140% at 50% -20%,
    var(--color-stage-glow) 0,
    var(--color-stage-falloff) 45%,
    var(--color-stage) 80%
  );

  &__top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
    min-height: 52px;
    margin-bottom: 16px;
  }

  &__title {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: 30px;
    line-height: 1;
    white-space: nowrap;

    &--wrapping {
      white-space: normal;
    }
  }

  @media (max-width: 760px) {
    &__title {
      font-size: 24px;
    }
  }
}
</style>

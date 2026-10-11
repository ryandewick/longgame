<script setup lang="ts">
import type { SessionBlock } from '#shared/types/session'

/**
 * How much of a block's planned time has gone: a thin line along the bottom edge of whatever
 * holds it, which has to be a positioned box (`position: relative`). It keeps time by itself,
 * like the clock it sits under, which already says the same thing to a screen reader.
 */
const { block } = defineProps<{
  block: SessionBlock
}>()

const now = useNow()

const share = computed(() => blockTimeShare(block, elapsedOnScreen(block, now.value)).toFixed(3))
</script>

<template>
  <span class="block-progress" :style="{ '--block-progress-share': share }" aria-hidden="true" />
</template>

<style lang="scss">
.block-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: calc(100% * var(--block-progress-share));
  height: 3px;
  background: var(--color-text);
  // glides from one second's width to the next rather than stepping
  transition: width 1s linear;
}
</style>

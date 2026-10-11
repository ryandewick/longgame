<script setup lang="ts">
/**
 * One of the player's own numbers (a level, XP, a clock), set the way the game sets them. The
 * styles are the shared `game-number` block: this component is the typed way to use it.
 */
const { tone = 'stat', size = 'text' } = defineProps<{
  /** 'stat' is the player's own figure; 'white' is secondary to a figure beside it; 'due' is for "Due" and "Done". */
  tone?: 'stat' | 'white' | 'due'
  /** 16px for text, 48px for the rack's headline count, 64px for a clock. */
  size?: 'text' | 'headline' | 'clock'
  /** Lets a two-word label break over two lines on a phone. */
  wrapping?: boolean
}>()
</script>

<template>
  <span
    class="game-number"
    :class="{
      'game-number--white': tone === 'white',
      'game-number--due': tone === 'due',
      'game-number--headline': size === 'headline',
      'game-number--clock': size === 'clock',
      'game-number--wrapping': wrapping,
    }"
  >
    <slot />
  </span>
</template>

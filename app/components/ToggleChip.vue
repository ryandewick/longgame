<script setup lang="ts">
/**
 * A chip that is on or off by itself: a setting, a shortcut, a quest ticked done. It is a button
 * that says whether it is pressed. The styles are the shared `chip` block; where the choice is
 * one of several, use `ChipGroup`.
 */
defineProps<{
  pressed: boolean
}>()

const emit = defineEmits<{
  /** The player pressed the chip: whoever holds the state flips it. */
  toggle: []
}>()
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="{ 'chip--selected': pressed }"
    :aria-pressed="pressed"
    @click="emit('toggle')"
  >
    <slot />
  </button>
</template>

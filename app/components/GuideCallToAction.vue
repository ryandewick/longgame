<script setup lang="ts">
/**
 * The way from a public page into the planner: the one primary button and, beside it, a line
 * saying what the planner adds to a guide. The slot replaces that line (the "not found" page
 * puts a second link there).
 */
</script>

<template>
  <div class="guide-call-to-action">
    <NuxtLink class="button button--primary" to="/">Open the planner</NuxtLink>
    <slot>Type your name to see which of these your account has unlocked.</slot>
  </div>
</template>

<style lang="scss">
.guide-call-to-action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin: 22px 0 26px;
  color: var(--color-text-muted);
}
</style>

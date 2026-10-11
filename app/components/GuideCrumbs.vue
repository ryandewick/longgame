<script setup lang="ts">
/**
 * The trail from the home page to this one: "Long Game / Training guides / Mining". Every step
 * but the last is a link; the last is the page itself.
 */
defineProps<{
  crumbs: readonly Crumb[]
}>()
</script>

<template>
  <nav class="guide-crumbs" aria-label="Breadcrumb">
    <ol class="guide-crumbs__list">
      <li v-for="crumb in crumbs" :key="crumb.label" class="guide-crumbs__step">
        <NuxtLink v-if="crumb.path" class="guide-crumbs__link" :to="crumb.path">
          {{ crumb.label }}
        </NuxtLink>
        <span v-else aria-current="page">{{ crumb.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style lang="scss">
.guide-crumbs {
  margin-bottom: 14px;
  color: var(--color-text-faint);
  font-size: 13px;

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.27em;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // the stroke between two steps belongs to the later one, so the first has none
  &__step + &__step::before {
    content: '/';
    margin-right: 0.27em;
  }

  &__link {
    color: var(--color-text-muted);
  }
}
</style>

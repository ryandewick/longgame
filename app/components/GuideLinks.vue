<script setup lang="ts">
import type { GuideLink } from '#shared/domain/guides'

/**
 * A grid of links to the training guides: each skill with its icon and how many methods its
 * guide holds, then the page of every AFK method.
 */
defineProps<{
  links: readonly GuideLink[]
}>()
</script>

<template>
  <ul class="guide-links">
    <li v-for="link in links" :key="link.path">
      <NuxtLink class="guide-links__link" :to="link.path">
        <SkillIcon v-if="link.skill" :skill="link.skill" />
        {{ link.label }}
        <span class="guide-links__count">{{ link.methodCount }} methods</span>
      </NuxtLink>
    </li>
  </ul>
</template>

<style lang="scss">
.guide-links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;

  &__link {
    display: flex;
    align-items: center;
    gap: 10px;
    // tall enough for the icon, so the one link without an icon is as tall as the rest
    min-height: 41px;
    padding: 8px 10px;
    border-radius: var(--radius);
    background: var(--color-slot);
    color: var(--color-text);
    font-weight: 600;
    text-decoration: none;

    &:hover {
      background: var(--color-raised);
      color: var(--color-text-strong);
    }
  }

  &__count {
    margin-left: auto;
    color: var(--color-text-faint);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }
}
</style>

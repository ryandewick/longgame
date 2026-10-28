<script setup lang="ts">
import { GUIDES_PATH } from '#shared/domain/guides'

/**
 * The frame of the public pages that are not the planner: the training guides and the "not
 * found" page. The brand, two links (the planner, the guides), the page, and the footer with the
 * credits. A guide can call up the "Suggest a method" form, and the toast that answers it.
 */
const route = useRoute()
const error = useError()
/** Addresses are compared without the slash a static host adds to the end. */
const withoutEndSlash = (path: string): string => path.replace(/\/+$/, '')

/**
 * How the guides link relates to the page shown: 'page' on the index itself, 'true' on a guide
 * under it, and nothing on the "not found" page, wherever its address says it is.
 */
const guidesCurrent = computed(() => {
  if (error.value) return undefined
  const path = withoutEndSlash(route.path)
  const guides = withoutEndSlash(GUIDES_PATH)
  if (path === guides) return 'page'
  return path.startsWith(`${guides}/`) ? 'true' : undefined
})
</script>

<template>
  <div class="guide-layout">
    <header class="guide-layout__header">
      <div class="guide-layout__bar page-width">
        <NuxtLink class="guide-layout__brand" to="/" aria-label="Long Game">
          <BrandMark />
        </NuxtLink>
        <nav class="guide-layout__nav" aria-label="Site">
          <NuxtLink class="guide-layout__link" to="/">Planner</NuxtLink>
          <NuxtLink
            class="guide-layout__link"
            :class="{ 'guide-layout__link--current': guidesCurrent }"
            :to="GUIDES_PATH"
            :aria-current="guidesCurrent"
          >
            Training guides
          </NuxtLink>
        </nav>
      </div>
    </header>
    <main class="guide-layout__main page-width">
      <slot />
    </main>
    <SiteFooter />
    <ToastHost />
    <SuggestMethodDialog />
  </div>
</template>

<style lang="scss">
.guide-layout {
  &__header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--color-ground);
  }

  &__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 22px;
    min-height: 66px;
    padding-block: 8px;
  }

  &__brand {
    text-decoration: none;
  }

  &__nav {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  // the same tab the planner's own navigation uses, with the yellow line under the section the page is in
  &__link {
    padding: 11px 13px 8px;
    border-bottom: 3px solid transparent;
    color: var(--color-text-muted);
    font: 600 15px/1 var(--font-text);
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      color: var(--color-text-strong);
    }

    &--current {
      border-bottom-color: var(--color-stat);
      color: var(--color-text-strong);
    }
  }

  &__main {
    padding-top: 24px;
    padding-bottom: 64px;
  }

  // Phones: the bar scrolls away with the page, as the planner's does.
  @media (max-width: 760px) {
    &__header {
      position: static;
    }

    &__link {
      padding: 8px 10px;
      font-size: 14px;
    }

    &__main {
      padding-top: 18px;
      padding-bottom: 48px;
    }
  }
}
</style>

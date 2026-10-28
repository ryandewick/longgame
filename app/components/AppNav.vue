<script setup lang="ts">
/**
 * The seven tabs of the planner, each a page of its own. The tab of the page being shown is
 * marked for screen readers and carries the yellow line. A change of page is instant: nothing
 * slides or fades.
 */
const TABS = [
  { label: 'Tonight', path: '/' },
  { label: 'Skills', path: '/skills' },
  { label: 'Methods', path: '/methods' },
  { label: 'Quests', path: '/quests' },
  { label: 'Resets', path: '/resets' },
  { label: 'History', path: '/history' },
  { label: 'Settings', path: '/settings' },
] as const

const route = useRoute()

/** A tab is current on its own page and on the pages under it: Skills on /skills/mining. */
function isCurrent(path: string): boolean {
  return route.path === path || (path !== '/' && route.path.startsWith(`${path}/`))
}

/** Pressing the tab of the page already open goes back to the top of it. */
function returnToTop(path: string): void {
  if (route.path === path) window.scrollTo({ top: 0 })
}
</script>

<template>
  <nav class="app-nav" aria-label="Views">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.path"
      :to="tab.path"
      class="app-nav__tab"
      :class="{ 'app-nav__tab--current': isCurrent(tab.path) }"
      :aria-current="isCurrent(tab.path) ? 'page' : undefined"
      @click="returnToTop(tab.path)"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<style lang="scss">
.app-nav {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  &__tab {
    position: relative;
    padding: 11px 13px 8px;
    border-bottom: 3px solid transparent;
    color: var(--color-text-muted);
    font: 600 15px/1 var(--font-text);
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;

    &:hover {
      color: var(--color-text-strong);
    }

    &--current {
      color: var(--color-text-strong);

      // the line is its own box, drawn over the tab's transparent border
      &::after {
        content: '';
        position: absolute;
        right: 0;
        bottom: -3px;
        left: 0;
        height: 3px;
        background: var(--color-stat);
      }
    }
  }

  @media (max-width: 760px) {
    flex-wrap: wrap;
    overflow: visible;

    &__tab {
      padding: 8px 10px;
      font-size: 14px;
    }
  }
}
</style>

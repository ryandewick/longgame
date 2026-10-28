<script setup lang="ts">
/**
 * The top bar. With an account: the wordmark as a link home, then the open account (its name
 * opens the menu of saved accounts), the refresh button and the tabs. Without one (a new visitor,
 * or a page whose save has not loaded yet) it is the wordmark alone.
 */
const account = useAccountStore()
const ready = useSaveReady()
const { isRefreshing, refresh } = useStatsRefresh()

const hasAccount = computed(() => ready.value && account.hasAccount)
const refreshLabel = computed(() => (isRefreshing.value ? 'Fetching…' : 'Refresh stats'))
</script>

<template>
  <header class="app-header">
    <div class="app-header__bar page-width">
      <template v-if="hasAccount">
        <NuxtLink class="app-header__brand" to="/" aria-label="Long Game">
          <BrandMark />
        </NuxtLink>
        <AccountSwitcher class="app-header__account" />
        <button
          type="button"
          class="button button--small app-header__refresh"
          :title="refreshLabel"
          :disabled="isRefreshing"
          @click="refresh"
        >
          <svg class="app-header__refresh-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
            <path d="M13.5 2.5v3h-3" />
          </svg>
          <span class="app-header__refresh-label">{{ refreshLabel }}</span>
        </button>
        <AppNav class="app-header__nav" />
      </template>
      <span v-else class="app-header__brand" role="img" aria-label="Long Game">
        <BrandMark />
      </span>
    </div>
  </header>
</template>

<style lang="scss">
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-ground);

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

  &__account {
    padding-left: 22px;
    border-left: 1px solid var(--color-edge);
  }

  &__nav {
    margin-left: auto;
  }

  // shown only when Refresh stats is an icon
  &__refresh-icon {
    display: none;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  // Too narrow for the bar as above but wider than a phone, such as the desktop app beside the
  // game: still one row. The account's status moves into its menu, Refresh stats becomes an icon
  // (its words kept for screen readers and its tooltip) and the tabs close up.
  @media (min-width: 761px) and (max-width: 1200px) {
    &__bar {
      flex-wrap: nowrap;
      column-gap: 16px;
    }

    &__account {
      padding-left: 16px;
    }

    &__refresh {
      display: grid;
      flex: none;
      place-items: center;
      width: 34px;
      height: 34px;
      padding: 0;
    }

    &__refresh-icon {
      display: block;
    }

    &__refresh-label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    &__nav {
      flex: none;
    }
  }

  // Narrower still, the row cannot hold a long name: the tabs take a row of their own, the first
  // tab's words under the wordmark (the tabs' 9px of padding is pulled out on both sides).
  @media (min-width: 761px) and (max-width: 860px) {
    &__bar {
      flex-wrap: wrap;
      row-gap: 2px;
    }

    &__refresh {
      margin-left: auto;
    }

    &__nav {
      order: 1;
      width: calc(100% + 18px);
      margin-inline: -9px;
    }
  }

  // Phones: the bar scrolls away with the page, the account takes a row of its own under the
  // brand and Refresh stats, and the tabs another. The bar keeps its place above the page, so the
  // account's menu opens over the rack.
  @media (max-width: 760px) {
    position: relative;

    &__bar {
      row-gap: 4px;
    }

    &__refresh {
      order: 1;
      margin-left: auto;
    }

    &__account {
      order: 2;
      width: 100%;
      padding-left: 0;
      border-left: 0;
    }

    &__nav {
      order: 3;
      width: 100%;
      margin-left: 0;
    }
  }
}
</style>

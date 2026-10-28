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
          :disabled="isRefreshing"
          @click="refresh"
        >
          {{ isRefreshing ? 'Fetching…' : 'Refresh stats' }}
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

<script setup lang="ts">
import { formatTimeAgo } from '#shared/domain/format'

/**
 * The top bar. With an account: the brand as a link home, whose mark shows progress to max, then
 * the player's name and how fresh their stats are, the refresh button and the tabs. Without one
 * (a new visitor, or a page whose save has not loaded yet) it is the brand alone.
 */
const account = useAccountStore()
const ready = useSaveReady()
const { isRefreshing, refresh } = useStatsRefresh()

const hasAccount = computed(() => ready.value && account.hasAccount)

// "5 min ago" moves on by itself, a minute at most behind the clock
const now = useNow(30_000)
const status = computed(() => {
  if (!account.hiscores) return ''
  const fetched = `stats ${formatTimeAgo(account.hiscores.fetchedAt, now.value)}`
  return account.isIronman ? `Ironman, ${fetched}` : fetched
})
</script>

<template>
  <header class="app-header">
    <div class="app-header__bar page-width">
      <template v-if="hasAccount">
        <NuxtLink class="app-header__brand" to="/" aria-label="Long Game">
          <BrandMark :progress="account.maxProgress.percent / 100" />
        </NuxtLink>
        <div class="app-header__account">
          <b class="app-header__name">{{ account.name }}</b>
          <span class="app-header__status">{{ status }}</span>
        </div>
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
  // holds still while the page below it changes (see view-transitions.scss)
  view-transition-name: top;

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
    line-height: 1.3;
  }

  &__name {
    display: block;
    color: var(--color-text);
    font-weight: 600;
  }

  &__status {
    display: block;
    color: var(--color-text-faint);
    font-size: 13px;
  }

  &__nav {
    margin-left: auto;
  }

  // Phones: the bar scrolls away with the page, the account line goes, and the tabs take a row of their own.
  @media (max-width: 760px) {
    position: static;

    &__account {
      display: none;
    }

    &__refresh {
      margin-left: auto;
    }

    &__nav {
      width: 100%;
      margin-left: 0;
    }
  }
}
</style>

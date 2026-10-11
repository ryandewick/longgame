<script setup lang="ts">
/**
 * The planner's frame: the top bar, the page, the footer, and the two things any page may call
 * up from anywhere, a toast and a confirm sheet.
 */
const account = useAccountStore()
const ready = useSaveReady()
const { refresh } = useStatsRefresh()

/** Stats older than this are fetched again when the app opens. */
const STATS_GO_STALE_AFTER_MILLISECONDS = 30 * 60_000

// The hiscores only move when the player logs out, so coming back to the app is the moment to look.
watch(
  ready,
  (isReady) => {
    if (!isReady || !account.hasAccount || !account.hiscores) return
    if (Date.now() - account.hiscores.fetchedAt > STATS_GO_STALE_AFTER_MILLISECONDS) void refresh()
  },
  { immediate: true },
)
</script>

<template>
  <div class="default-layout">
    <AppHeader />
    <slot />
    <SiteFooter />
    <ToastHost />
    <ConfirmDialog />
    <SuggestMethodDialog />
    <ShareRackDialog />
  </div>
</template>

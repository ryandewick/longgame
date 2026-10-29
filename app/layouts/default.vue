<script setup lang="ts">
/**
 * The planner's frame: the top bar, the page, the footer, and what any page may call up from
 * anywhere: a toast, a confirm sheet, and the dialogs for suggesting a method, sharing the rack
 * and adding an account.
 */
const ready = useSaveReady()
const { refreshOnOpen } = useStatsRefresh()

// The hiscores only move when the player logs out, so coming back to the app is the moment to look.
watch(
  ready,
  (isReady) => {
    if (isReady) refreshOnOpen()
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
    <AddAccountDialog />
  </div>
</template>

<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'

/**
 * What every planner page puts its content in. It decides what can be drawn:
 *
 * - with no account, the first-visit screen: the setup screen and, on the website's home page,
 *   the landing content below it;
 * - with an account, the rack (on the pages that show it) and the page's own content.
 *
 * So whatever a page puts in the default slot is only ever rendered in the browser, with the save
 * loaded and an account in the stores.
 *
 * Until the save has loaded there is no knowing which of the two it will be, and the browser's
 * first render has to match what the server sent. On the website the server sends the first-visit
 * screen, so that a new visitor and a search engine get a real page. A returning player is sent
 * it too, but never sees it: a script in the head has already marked the document, and a marked
 * document hides it (see utils/returning-player.ts). A local copy keeps its save on its own
 * server, where that script cannot look, so it draws nothing until the save has loaded.
 */
const { currentSkill = null } = defineProps<{
  /** Hang the rack above the content: Tonight and Skills do. */
  rack?: boolean
  /** The cape the rack brings forward. */
  currentSkill?: SkillKey | null
}>()

const account = useAccountStore()
const ready = useSaveReady()
const route = useRoute()
const isWebsite = useAppMode() === 'hosted'

const showsFirstVisit = computed(() => (ready.value ? !account.hasAccount : isWebsite))
const showsLanding = computed(() => isWebsite && route.path === '/')

// From here on the stores say whether there is an account, so the head script's guess is retired.
// Left on, it would hide the setup screen from a player who goes on to forget their account.
// And from here on this page draws what it is going to draw: for the first planner page of a
// visit that is the first load, which the rack marks if it is on the page (see useMotion). A
// later page announces it too and is not heard, so the rack never fills on a change of page.
if (import.meta.client) {
  watch(
    ready,
    (isReady) => {
      if (!isReady) return
      document.documentElement.classList.remove(RETURNING_PLAYER_CLASS)
      announceMoment({ name: 'first-load' })
    },
    { immediate: true },
  )

  // An account loaded from the setup screen is a first load as well: the planner is drawn for
  // the first time, so its rack fills from empty. It is said here and not by the setup screen,
  // because the rack is hung the moment the stats arrive, which is before the lookup has
  // finished: said any later, the rack would show full for a moment and then empty itself.
  watch(
    () => account.hasAccount,
    (hasAccount, hadAccount) => {
      if (!ready.value || !hasAccount || hadAccount) return
      expectFirstLoad()
      // The setup screen goes on to Tonight when the lookup is done. Anywhere else, the moment
      // waits for Tonight to be drawn, which announces it like any first planner page.
      if (route.path === '/') announceMoment({ name: 'first-load' })
    },
  )
}

// The home page is the one planner address with something for a search engine to list. The others
// are a player's own screens, which a visitor with no account sees as the setup screen alone.
useHead({
  meta: () => (route.path === '/' ? [] : [{ name: 'robots', content: 'noindex, follow' }]),
})
</script>

<template>
  <div v-if="showsFirstVisit" class="planner-page planner-page--first-visit">
    <SetupScreen class="planner-page__first-visit">
      <template v-if="showsLanding" #default>
        <LandingSections />
      </template>
    </SetupScreen>
  </div>
  <div v-else-if="!ready" class="planner-page planner-page--waiting" />
  <div v-else class="planner-page">
    <CapeRack v-if="rack" :current-skill="currentSkill" />
    <main class="planner-page__content page-width">
      <slot />
    </main>
  </div>
</template>

<style lang="scss">
.planner-page {
  // holds the footer below the fold until there is a page to put above it
  &--waiting {
    min-height: 100vh;
  }

  &__content {
    padding-top: 24px;
    padding-bottom: 64px;
    // crossfades and rises when the page changes (see view-transitions.scss)
    view-transition-name: main;

    // Where the browser cannot animate a change of page itself, the new page still rises in.
    @supports not (view-transition-name: none) {
      animation: planner-page-rise 0.22s ease-out both;
    }
  }

  @media (max-width: 760px) {
    &__content {
      padding-top: 18px;
      padding-bottom: 48px;
    }
  }
}

// A returning player's document, marked before anything is painted (see utils/returning-player.ts):
// the first-visit screen the server sent is there but not shown, and its place is held open the
// way the waiting page's is. These are the only selectors in the app that start outside their own
// block, because what they answer to is on <html>, which no component draws.
.returning-player .planner-page--first-visit {
  min-height: 100vh;
}

.returning-player .planner-page__first-visit {
  display: none;
}

@keyframes planner-page-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
</style>

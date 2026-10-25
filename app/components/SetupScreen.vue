<script setup lang="ts">
import { SKILL_KEYS } from '#shared/data/skills'
import { MAX_LEVEL } from '#shared/domain/xp'
import type { RailCape } from './CapeRail.vue'

/**
 * What a visitor with no account sees: the rack as it will look part-way through, then the one
 * thing to do, which is to give a name. Whatever is put in the default slot follows the panel
 * (the website's home page puts its landing content there).
 *
 * On the website this is part of the page the server sends, so it is drawn before the save has
 * loaded (see PlannerPage), and nothing here may count on the stores until `useSaveReady` says so.
 */
const account = useAccountStore()
const ready = useSaveReady()
const mode = useAppMode()
const { isRefreshing, loadAccount } = useAccounts()

/** The demonstration starts here and climbs evenly, so every cape is a little fuller than the last. */
const LOWEST_SAMPLE_LEVEL = 30
const SAMPLE_LEVEL_SPREAD = 66
/** How much of the demonstration's max cape is in colour. */
const SAMPLE_MAX_CAPE_FILL = 38

const sampleCapes: RailCape[] = SKILL_KEYS.map((skill, place) => {
  const lastPlace = SKILL_KEYS.length - 1
  const level =
    place === lastPlace
      ? MAX_LEVEL
      : Math.round(LOWEST_SAMPLE_LEVEL + place * (SAMPLE_LEVEL_SPREAD / lastPlace))
  return { skill, level }
})

/** The capes fanned in the panel's swatch, the last on top. */
const FANNED_CAPES = ['fishing', 'firemaking', 'woodcutting'] as const

const help =
  mode === 'local'
    ? 'Running locally. Nothing leaves this machine except the two lookups.'
    : 'Your name is looked up on the official hiscores. Everything else stays in this browser.'

// A name that was typed before but could not be looked up is still there to correct. It arrives
// with the save, which may be after this is drawn; by then a new name may already be half typed.
const name = ref(account.name)
watch(ready, () => {
  if (!name.value) name.value = account.name
})
const nameField = useTemplateRef('nameField')
const nameFieldId = useId()

// The demonstration fills like a player's own rack does on the first load, but only when the
// browser drew it. A rack the server sent has been on screen, in colour, since before the app
// started: emptying it now to fill it again would be a flash, so that one is left as it is.
const rail = useTemplateRef('rail')
const wasDrawnByServer = useNuxtApp().isHydrating === true
useMotion().onMoment('first-load', () => {
  if (!wasDrawnByServer) rail.value?.fillFromEmpty()
})

onMounted(() => nameField.value?.focus({ preventScroll: true }))

async function submit(): Promise<void> {
  // an account started before the save has loaded would be overwritten by the save when it arrives
  if (!ready.value) return
  // The planner takes this screen's place the moment the account is added with its stats, and its
  // rack fills from empty as on any first load: PlannerPage sees the account arrive and says so.
  if (await loadAccount(name.value)) await navigateTo('/')
}
</script>

<template>
  <div class="setup-screen">
    <RackStage wrap-title>
      <template #title>Every skillcape on one rail.</template>
      <p class="setup-screen__summary">
        Each one fills with colour as you level. The max cape waits at the end.
      </p>
      <template #rail>
        <CapeRail ref="rail" :capes="sampleCapes" :max-cape-fill="SAMPLE_MAX_CAPE_FILL" />
      </template>
    </RackStage>

    <main class="setup-screen__main page-width">
      <section class="setup-screen__panel">
        <div class="setup-screen__swatch">
          <CapeFan :skills="FANNED_CAPES" />
        </div>
        <div class="setup-screen__body">
          <h2 class="setup-screen__title">Start with your name</h2>
          <p class="setup-screen__note">
            Long Game pulls your stats from the hiscores, then deals you sessions built from what
            your account can actually do tonight.
          </p>
          <form class="setup-screen__form" @submit.prevent="submit">
            <div class="field">
              <label class="field__label" :for="nameFieldId">RuneScape name</label>
              <div class="field__row">
                <input
                  :id="nameFieldId"
                  ref="nameField"
                  v-model="name"
                  class="input"
                  placeholder="your RSN"
                  autocomplete="off"
                  spellcheck="false"
                />
                <button type="submit" class="button button--primary" :disabled="isRefreshing">
                  {{ isRefreshing ? 'Fetching…' : 'Load my account' }}
                </button>
              </div>
              <span class="field__help">{{ help }}</span>
            </div>
          </form>
        </div>
      </section>
      <div v-if="$slots.default" class="setup-screen__more">
        <slot />
      </div>
    </main>
  </div>
</template>

<style lang="scss">
.setup-screen {
  &__summary {
    color: var(--color-text-muted);
  }

  &__main {
    padding-top: 24px;
    padding-bottom: 64px;
  }

  // the panel: a swatch with the fanned capes, then the words
  &__panel {
    position: relative;
    display: grid;
    grid-template-columns: 176px minmax(0, 1fr);
    max-width: 820px;
    min-height: 226px;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--color-panel);
    box-shadow: 0 0 0 1px var(--color-edge);
  }

  // where a skill's panel shows its cape colour and trim, this one is plain with a brass trim
  &__swatch {
    position: relative;
    min-height: 150px;
    overflow: hidden;
    border-right: 10px solid var(--color-brass);
    background: var(--color-cape-plain);
  }

  &__body {
    min-width: 0;
    padding: 20px 26px 22px;
  }

  &__title {
    margin-bottom: 4px;
    font-size: 34px;
    line-height: 1.05;
  }

  &__note {
    max-width: 54ch;
    margin-top: 2px;
    color: var(--color-text-muted);
  }

  &__form {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 36px;
    margin-top: 16px;
  }

  // what follows the panel starts well clear of it, as a part of the page in its own right
  &__more {
    margin-top: 104px;
  }

  @media (max-width: 760px) {
    &__main {
      padding-top: 18px;
      padding-bottom: 48px;
    }

    &__panel {
      grid-template-columns: minmax(0, 1fr);
    }

    &__swatch {
      border-right: 0;
      border-bottom: 8px solid var(--color-brass);
    }

    &__body {
      padding: 16px 18px 6px;
    }

    &__title {
      font-size: 26px;
    }

    &__more {
      margin-top: 64px;
    }
  }
}
</style>

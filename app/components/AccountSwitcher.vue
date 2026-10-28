<script setup lang="ts">
import type { AccountRow } from '~/utils/account-list'

/**
 * The account in the top bar, and the menu of saved accounts it opens. The button is the open
 * account's name with how fresh its stats are under it. The menu lists every saved account in the
 * order they were added, each known by its three highest capes, its type, how fresh its stats are
 * and its total level, the open one marked, then "Add an account". Where the top bar is one tight
 * row the button shows the name alone, and the menu is where the status is read.
 *
 * It is a disclosure: a button that shows and hides a panel of ordinary buttons, reached with Tab.
 * Escape, a click outside it, moving the focus out of it and a change of page close it. While a
 * lookup is under way the other accounts cannot be opened, since its answer is for this one.
 */
const account = useAccountStore()
const list = useAccountListStore()
const { isRefreshing, open } = useAccounts()
const { open: openAddDialog } = useAddAccount()
const route = useRoute()

// "5 min ago" moves on by itself, a minute at most behind the clock
const now = useNow(30_000)
const status = computed(() => accountStatus(account.accountType, account.hiscores, now.value))
const buttonLabel = computed(() => accountButtonLabel(account.name, status.value))
const rows = computed(() => accountRows(list.accounts, list.openIndex, now.value))

const root = useTemplateRef('root')
const trigger = useTemplateRef('trigger')
const menuId = useId()
const headingId = useId()
const isOpen = shallowRef(false)

function close(returnFocus = false): void {
  isOpen.value = false
  if (returnFocus) trigger.value?.focus()
}

async function choose(row: AccountRow): Promise<void> {
  close(true)
  if (!row.isOpen) await open(row.name)
}

/** The add dialog opens over the page; closing it hands the focus back to this button. */
function addAccount(): void {
  close(true)
  openAddDialog()
}

const isInside = (target: EventTarget | null): boolean =>
  target instanceof Node && (root.value?.contains(target) ?? false)

function onPointerDownAnywhere(event: PointerEvent): void {
  if (!isInside(event.target)) close()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !isOpen.value) return
  event.stopPropagation()
  close(true)
}

function onFocusOut(event: FocusEvent): void {
  if (isOpen.value && !isInside(event.relatedTarget)) close()
}

watch(isOpen, (opened) => {
  if (opened) document.addEventListener('pointerdown', onPointerDownAnywhere)
  else document.removeEventListener('pointerdown', onPointerDownAnywhere)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDownAnywhere))
watch(
  () => route.fullPath,
  () => close(),
)
</script>

<template>
  <div ref="root" class="account-switcher" @keydown="onKeydown" @focusout="onFocusOut">
    <button
      ref="trigger"
      type="button"
      class="account-switcher__trigger"
      :class="{ 'account-switcher__trigger--open': isOpen }"
      :aria-label="buttonLabel"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? menuId : undefined"
      @click="isOpen = !isOpen"
    >
      <span class="account-switcher__name">
        {{ account.name }}
        <svg
          class="account-switcher__caret"
          :class="{ 'account-switcher__caret--open': isOpen }"
          viewBox="0 0 10 6"
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </span>
      <span class="account-switcher__status">{{ status }}</span>
    </button>

    <div v-if="isOpen" :id="menuId" class="account-switcher__menu">
      <p :id="headingId" class="account-switcher__heading">Your accounts</p>
      <ul class="account-switcher__list" :aria-labelledby="headingId">
        <li v-for="row in rows" :key="row.name">
          <button
            type="button"
            class="account-switcher__account"
            :class="{ 'account-switcher__account--open': row.isOpen }"
            :aria-label="row.label"
            :aria-current="row.isOpen ? 'true' : undefined"
            :disabled="isRefreshing && !row.isOpen"
            @click="choose(row)"
          >
            <span class="account-switcher__capes" aria-hidden="true">
              <img
                v-for="(cape, place) in row.capes"
                :key="cape.skill"
                class="account-switcher__cape"
                :style="{ '--account-switcher-place': place }"
                :src="capeImageUrl(cape.skill, cape.trimmed)"
                alt=""
              />
            </span>
            <span class="account-switcher__who">
              <span class="account-switcher__account-name">
                {{ row.name }}
                <span v-if="row.isOpen" class="tag">Open</span>
              </span>
              <span class="account-switcher__kind">{{ row.detail }}</span>
            </span>
            <span v-if="row.totalLevel" class="account-switcher__total">
              <GameNumber>{{ row.totalLevel }}</GameNumber>
              <span class="account-switcher__total-label">total level</span>
            </span>
          </button>
        </li>
      </ul>
      <div class="account-switcher__rule" />
      <button type="button" class="account-switcher__add" @click="addAccount">
        <span class="account-switcher__plus" aria-hidden="true" />
        Add an account
      </button>
    </div>
  </div>
</template>

<style lang="scss">
.account-switcher {
  position: relative;

  // the account's name and status, as the top bar has always shown them, with a caret
  &__trigger {
    display: block;
    // pulled into the space before it, so the words sit where they always have and the
    // highlight has room around them
    margin: -5px 0 -5px -8px;
    padding: 5px 8px;
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: inherit;
    font: inherit;
    line-height: 1.3;
    text-align: left;
    cursor: pointer;

    &:hover,
    &--open {
      background: var(--color-raised);
    }
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text);
    font-weight: 600;
  }

  &__caret {
    flex: none;
    width: 10px;
    height: 6px;
    fill: none;
    stroke: var(--color-text-muted);
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;

    // pointing up while the menu is open
    &--open {
      transform: rotate(180deg);
    }
  }

  &__status {
    display: block;
    color: var(--color-text-faint);
    font-size: 13px;
  }

  // the menu: an overlay, so it alone in the top bar casts a shadow
  &__menu {
    position: absolute;
    top: calc(100% + 12px);
    left: -8px;
    z-index: 1;
    width: 344px;
    padding: 8px;
    border-radius: var(--radius);
    background: var(--color-panel);
    box-shadow:
      0 0 0 1px var(--color-edge-strong),
      var(--shadow-dialog);
  }

  &__heading {
    padding: 4px 10px 8px;
    color: var(--color-text-faint);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
  }

  &__list {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // a row: the account's capes, its name and type, its total level
  &__account {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 62px;
    padding: 5px 12px 5px 6px;
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--color-raised);
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }

    &--open,
    &--open:hover {
      background: var(--color-selected);
    }
  }

  // three capes fanned from one hanger, as on the setup screen, small
  &__capes {
    position: relative;
    align-self: stretch;
  }

  &__cape {
    position: absolute;
    top: 3px;
    left: calc(50% - 12px);
    width: 24px;
    transform: rotate(calc((var(--account-switcher-place) - 1) * 15deg));
    transform-origin: 50% 4%;
    filter: drop-shadow(var(--shadow-cape-small));
  }

  &__who {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  &__account-name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: var(--color-text-strong);
    font: 700 16px/1.25 var(--font-text);
    overflow-wrap: anywhere;
  }

  &__kind {
    color: var(--color-text-faint);
    font-size: 13px;
    line-height: 1.2;
  }

  &__total {
    display: grid;
    justify-items: end;
    gap: 5px;
  }

  &__total-label {
    color: var(--color-text-faint);
    font-size: 12px;
    line-height: 1;
  }

  &__rule {
    height: 1px;
    margin: 8px 4px;
    background: var(--color-edge);
  }

  &__add {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 42px;
    padding: 4px 12px 4px 6px;
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: var(--color-text);
    font: 600 15px/1.2 var(--font-text);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--color-raised);
    }
  }

  // a plus in a box the shape of a tick box
  &__plus {
    position: relative;
    justify-self: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius);
    background: var(--color-stage);
    box-shadow: inset 0 0 0 1px var(--color-edge-strong);

    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 11px;
      left: 7px;
      width: 10px;
      height: 2px;
      background: var(--color-text);
    }

    &::after {
      transform: rotate(90deg);
    }
  }

  // the top bar as one tight row: see AppHeader
  @media (min-width: 761px) and (max-width: 1200px) {
    &__status {
      display: none;
    }
  }

  // Phones: the account is a row of its own under the brand, its name and status on one line,
  // and the menu as wide as the row.
  @media (max-width: 760px) {
    &__trigger {
      display: flex;
      align-items: baseline;
      gap: 10px;
      width: calc(100% + 16px);
      margin: 0 -8px;
      padding: 7px 8px;
    }

    &__status {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__menu {
      top: calc(100% + 6px);
      right: 0;
      left: 0;
      width: auto;
    }
  }
}
</style>

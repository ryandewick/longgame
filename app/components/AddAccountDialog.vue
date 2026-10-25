<script setup lang="ts">
/**
 * "Add an account": the setup screen's panel in a dialog, the fanned capes on a plain swatch with
 * a brass trim and the one field, so adding an account feels like the first visit. The name is
 * looked up before anything is added; what stops it (a name not on the hiscores, a lookup that
 * failed) is said in the form. A name already saved opens that account instead.
 *
 * It is the browser's own modal dialog, as the confirm sheet is: focus stays inside while it is
 * open, Escape and a click on the dimmed page close it, and focus goes back to whatever had it.
 * While the name is being looked up it stays open, as the account is about to be added.
 */
const { isOpen, close } = useAddAccount()
const { isRefreshing, add } = useAccounts()
const account = useAccountStore()
const toast = useToast()

/** The capes fanned in the swatch, as the setup screen fans them, the last on top. */
const FANNED_CAPES = ['fishing', 'firemaking', 'woodcutting'] as const

const dialog = useTemplateRef('dialog')
const nameField = useTemplateRef('nameField')
const titleId = useId()
const fieldId = useId()

/** Drawn from the first time it opens, then kept, so it closes the browser's way. */
const hasOpened = shallowRef(false)
const name = shallowRef('')
const isAdding = shallowRef(false)
/** Why the last name could not be added, said in the form. */
const refusal = shallowRef('')

watch(isOpen, (open) => {
  if (!open) {
    dialog.value?.close()
    return
  }
  // every opening starts afresh: a name half typed for another account is not this one
  name.value = ''
  refusal.value = ''
  hasOpened.value = true
  void nextTick(() => {
    if (dialog.value && !dialog.value.open) dialog.value.showModal()
    nameField.value?.focus()
  })
})

/** Escape closes the dialog by itself, except while a name is being looked up. */
function onCancel(event: Event): void {
  if (isAdding.value) event.preventDefault()
}

/** The composable still has to hear that the dialog closed. */
function onClose(): void {
  if (isOpen.value) close()
}

// A click counts as on the backdrop only when it was pressed there too, so dragging to select
// the typed name and letting go outside the panel does not close it.
let pressedOnBackdrop = false

function onPointerDown(event: PointerEvent): void {
  pressedOnBackdrop = event.target === dialog.value
}

/** The dialog's padding is on its panel, so a click that lands on the dialog itself is on the backdrop. */
function onClick(event: MouseEvent): void {
  if (pressedOnBackdrop && event.target === dialog.value && !isAdding.value) close()
}

async function submit(): Promise<void> {
  if (isAdding.value) return
  isAdding.value = true
  refusal.value = ''
  try {
    const typed = name.value.trim()
    const outcome = await add(typed)
    if (outcome.kind === 'refused') {
      refusal.value = outcome.problem
      nameField.value?.focus()
      return
    }
    close()
    if (outcome.kind === 'added') {
      toast.show(`Added ${typed}. Switch accounts from the name at the top.`)
    }
  } finally {
    isAdding.value = false
  }
}
</script>

<template>
  <dialog
    v-if="hasOpened"
    ref="dialog"
    class="add-account-dialog"
    :aria-labelledby="titleId"
    @cancel="onCancel"
    @close="onClose"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <div class="add-account-dialog__panel">
      <div class="add-account-dialog__swatch">
        <CapeFan :skills="FANNED_CAPES" />
      </div>
      <form class="add-account-dialog__body" @submit.prevent="submit">
        <h2 :id="titleId" class="add-account-dialog__title">Add an account</h2>
        <p class="add-account-dialog__note">
          Keep another account beside {{ account.name }}. Each keeps its own ticks, sessions,
          history and settings, and you switch between them from the menu under your name.
        </p>
        <div class="field">
          <label class="field__label" :for="fieldId">RuneScape name</label>
          <div class="field__row">
            <input
              :id="fieldId"
              ref="nameField"
              v-model="name"
              class="input"
              placeholder="RSN"
              autocomplete="off"
              spellcheck="false"
              :aria-invalid="refusal ? 'true' : undefined"
            />
          </div>
          <span class="field__help">Looked up on the official hiscores.</span>
        </div>
        <p v-if="refusal" class="add-account-dialog__refusal" role="alert">{{ refusal }}</p>
        <div class="action-row action-row--end add-account-dialog__actions">
          <button type="button" class="button" :disabled="isAdding" @click="close">Cancel</button>
          <button type="submit" class="button button--primary" :disabled="isAdding || isRefreshing">
            {{ isAdding ? 'Looking up…' : 'Add account' }}
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>

<style lang="scss">
.add-account-dialog {
  width: 100%;
  // a little air between the sheet and the edges of a small window
  max-width: min(664px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: var(--color-panel);
  box-shadow:
    0 0 0 1px var(--color-edge-strong),
    var(--shadow-dialog);
  color: var(--color-text);

  &::backdrop {
    background: var(--color-scrim);
  }

  // the setup screen's panel: a swatch with the fanned capes, then the words
  &__panel {
    display: grid;
    grid-template-columns: 176px minmax(0, 1fr);
  }

  // plain, with a brass trim, where a skill's panel would show its cape colour and trim
  &__swatch {
    position: relative;
    min-height: 150px;
    overflow: hidden;
    border-right: 10px solid var(--color-brass);
    background: var(--color-cape-plain);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 26px 30px 28px;
  }

  &__title {
    font-size: 24px;
    line-height: 1.05;
  }

  &__note {
    color: var(--color-text-muted);
  }

  &__refusal {
    color: var(--color-warning);
    font-weight: 600;
  }

  &__actions {
    margin-top: 6px;
  }

  @media (max-width: 760px) {
    max-width: calc(100vw - 32px);

    &__panel {
      grid-template-columns: minmax(0, 1fr);
    }

    &__swatch {
      min-height: 132px;
      border-right: 0;
      border-bottom: 8px solid var(--color-brass);
    }

    &__body {
      padding: 18px 18px 20px;
    }
  }
}
</style>

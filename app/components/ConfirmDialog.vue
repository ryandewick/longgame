<script setup lang="ts">
/**
 * The confirm sheet: a question, Cancel, and the one button that goes ahead. `useConfirm().confirm()`
 * opens it and resolves with the answer.
 *
 * It is the browser's own modal dialog, which keeps focus inside while it is open, closes on
 * Escape and hands focus back to whatever had it. A click on the dimmed page behind it cancels.
 */
const { request, answer } = useConfirm()

const dialog = useTemplateRef('dialog')
const titleId = useId()

// The question is kept on screen while the dialog closes, so its text does not vanish first.
const shown = shallowRef(request.value)

watch(request, (question) => {
  if (!question) {
    dialog.value?.close()
    return
  }
  shown.value = question
  // the dialog element is rendered once there is a question to show; a second question asked
  // while the first is still up finds it already open
  void nextTick(() => {
    if (dialog.value && !dialog.value.open) dialog.value.showModal()
  })
})

/** Escape closes the dialog by itself; the answer still has to be given. */
function onClose(): void {
  if (request.value) answer(false)
}

/** The dialog's padding is on its panel, so a click that lands on the dialog itself is on the backdrop. */
function onClick(event: MouseEvent): void {
  if (event.target === dialog.value) answer(false)
}
</script>

<template>
  <dialog
    v-if="shown"
    ref="dialog"
    class="confirm-dialog"
    :aria-labelledby="titleId"
    @close="onClose"
    @click="onClick"
  >
    <div class="confirm-dialog__panel">
      <h2 :id="titleId" class="confirm-dialog__title">{{ shown.title }}</h2>
      <p class="confirm-dialog__body">{{ shown.body }}</p>
      <div class="action-row action-row--end confirm-dialog__actions">
        <button type="button" class="button" @click="answer(false)">Cancel</button>
        <button type="button" class="button button--primary" autofocus @click="answer(true)">
          {{ shown.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style lang="scss">
.confirm-dialog {
  width: 100%;
  // a little air between the sheet and the edges of a small window
  max-width: min(520px, calc(100vw - 40px));
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

  &__panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 26px 30px;
  }

  &__title {
    font-size: 24px;
    line-height: 1.05;
  }

  &__body {
    color: var(--color-text-muted);
  }

  &__actions {
    margin-top: 8px;
  }
}
</style>

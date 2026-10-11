<script setup lang="ts">
/**
 * The share sheet: the picture of the account's rack, and the ways to take it away. Download is
 * always there; Copy image and Share appear where the browser and the device can do them.
 * `useShareRack().open()` draws the picture and opens this.
 *
 * It is the browser's own modal dialog, which keeps focus inside while it is open, closes on
 * Escape and hands focus back to whatever had it. A click on the dimmed page behind it closes it.
 */
const { share, close, copy, send } = useShareRack()

const dialog = useTemplateRef('dialog')
const titleId = useId()

// The picture is kept on screen while the dialog closes, so it does not vanish first.
const shown = shallowRef(share.value)
/** What became of the last Copy. Said here because a toast would be behind the dialog. */
const notice = shallowRef('')

watch(share, (picture) => {
  if (!picture) {
    dialog.value?.close()
    return
  }
  shown.value = picture
  notice.value = ''
  // the dialog element is rendered once there is a picture to show
  void nextTick(() => {
    if (dialog.value && !dialog.value.open) dialog.value.showModal()
  })
})

/** Escape closes the dialog by itself; the composable still has to hear of it. */
function onClose(): void {
  if (share.value) close()
}

/** The dialog's padding is on its panel, so a click that lands on the dialog itself is on the backdrop. */
function onClick(event: MouseEvent): void {
  if (event.target === dialog.value) close()
}

async function copyPicture(): Promise<void> {
  notice.value = ''
  notice.value = await copy()
}
</script>

<template>
  <dialog
    v-if="shown"
    ref="dialog"
    class="share-rack-dialog"
    :aria-labelledby="titleId"
    @close="onClose"
    @click="onClick"
  >
    <div class="share-rack-dialog__panel">
      <h2 :id="titleId" class="share-rack-dialog__title">Your rack</h2>
      <img
        class="share-rack-dialog__picture"
        :src="shown.url"
        :width="RACK_PICTURE_WIDTH"
        :height="RACK_PICTURE_HEIGHT"
        :alt="shown.description"
      />
      <div class="action-row action-row--end share-rack-dialog__actions">
        <!-- always on the page, empty: a screen reader only announces changes inside a live region it knows -->
        <p class="share-rack-dialog__notice" role="status">{{ notice }}</p>
        <button type="button" class="button" @click="close">Close</button>
        <button v-if="shown.canCopy" type="button" class="button" @click="copyPicture">
          Copy image
        </button>
        <button v-if="shown.canSend" type="button" class="button" @click="send">Share</button>
        <a class="button button--primary" :href="shown.url" :download="shown.fileName" autofocus>
          Download
        </a>
      </div>
    </div>
  </dialog>
</template>

<style lang="scss">
.share-rack-dialog {
  width: 100%;
  // a little air between the sheet and the edges of a small window
  max-width: min(880px, calc(100vw - 40px));
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

  &__picture {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--radius);
    box-shadow: 0 0 0 1px var(--color-edge-strong);
  }

  &__actions {
    margin-top: 8px;
  }

  // what became of a Copy, at the left of the row of buttons
  &__notice {
    margin-right: auto;
    color: var(--color-text-muted);
    font-weight: 600;
  }
}
</style>

<script setup lang="ts">
/**
 * Where toasts appear: the foot of the window, in the game's parchment dialog. The host is
 * always on the page, empty, because a screen reader only announces changes inside a live
 * region it already knows about. `useToast().show()` puts a message in it.
 */
const { toast } = useToast()
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <div v-if="toast" class="toast-host__toast">
      <b v-if="toast.lead" class="toast-host__lead">{{ toast.lead }}</b>
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<style lang="scss">
.toast-host {
  position: fixed;
  bottom: 28px;
  left: 50%;
  z-index: 70;
  max-width: calc(100vw - 40px);
  transform: translateX(-50%);

  &__toast {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 10px 18px;
    border: 2px solid var(--color-parchment-edge);
    outline: 1px solid var(--color-parchment-outline);
    background: var(--color-parchment);
    box-shadow: var(--shadow-toast);
    color: var(--color-ink);
    font: 600 15px/1.3 var(--font-text);
  }

  &__lead {
    font-weight: 800;
  }
}
</style>

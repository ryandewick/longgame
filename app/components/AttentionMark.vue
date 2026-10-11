<script setup lang="ts">
import type { Intensity } from '#shared/types/method'
import { INTENSITY_LABELS } from '#shared/domain/format'

/**
 * How much attention a method takes: a circle that is hollow (AFK), half filled (Semi-AFK) or
 * filled (Active), with the word beside it. A shape and never a colour, because colour belongs
 * to the capes.
 */
defineProps<{
  intensity: Intensity
}>()
</script>

<template>
  <span class="attention-mark">
    <span
      class="attention-mark__circle"
      :class="{
        'attention-mark__circle--half': intensity === 'semi',
        'attention-mark__circle--full': intensity === 'active',
      }"
    />
    {{ INTENSITY_LABELS[intensity] }}
  </span>
</template>

<style lang="scss">
.attention-mark {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;

  &__circle {
    flex: none;
    width: 11px;
    height: 11px;
    border: 2px solid currentcolor;
    border-radius: 50%;

    &--half {
      background: linear-gradient(90deg, currentcolor 50%, transparent 50%);
    }

    &--full {
      background: currentcolor;
    }
  }
}
</style>

<script setup lang="ts" generic="Value extends string | number">
/**
 * A small set of choices of which one is on: tonight's length, the mood, the sort order. Each
 * choice is a button that says whether it is pressed, inside a group with a name of its own.
 * The styles are the shared `chip-group` and `chip` blocks.
 */
defineProps<{
  /** What the choice is, for screen readers: "Session length". */
  label: string
  options: readonly { readonly value: Value; readonly label: string }[]
}>()

const selected = defineModel<Value>({ required: true })
</script>

<template>
  <div class="chip-group" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="chip"
      :class="{ 'chip--selected': option.value === selected }"
      :aria-pressed="option.value === selected"
      @click="selected = option.value"
    >
      <slot name="option" :option="option" :selected="option.value === selected">
        {{ option.label }}
      </slot>
    </button>
  </div>
</template>

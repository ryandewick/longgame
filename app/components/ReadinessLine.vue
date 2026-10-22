<script setup lang="ts">
/**
 * What a quest or diary tier not done says under its name: ready, ready with a boost, or what it
 * still needs, in one short line, with the whole sentence on hover. Inside a tick box a screen
 * reader hears only the box's label, so given `sentenceId` it also holds the whole sentence (the
 * account's own figures included) out of sight, for the box to be described by; the short line is
 * then for the eye alone.
 */
const {
  readiness,
  sentenceId = undefined,
  wrap = false,
} = defineProps<{
  readiness: RowReadiness
  /** The id the whole sentence takes, for a tick box's aria-describedby. */
  sentenceId?: string
  /** Let the line run on to a second one instead of cutting it short. */
  wrap?: boolean
}>()
</script>

<template>
  <span
    class="readiness-line"
    :class="{ 'readiness-line--ready': readiness.ready, 'readiness-line--wrap': wrap }"
    :title="readiness.sentence"
  >
    <span :aria-hidden="sentenceId ? 'true' : undefined">{{ readiness.line }}</span>
    <span v-if="sentenceId" :id="sentenceId" class="visually-hidden">{{ readiness.sentence }}</span>
  </span>
</template>

<style lang="scss">
// positioned, so the sentence kept out of sight sits inside the line and is cut with it, rather
// than placed after a long line's text, past the edge of the page
.readiness-line {
  position: relative;
  display: block;
  overflow: hidden;
  margin-top: 1px;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;

  // ready is said in words, in bone at 600, never in a colour of its own
  &--ready {
    color: var(--color-text);
    font-weight: 600;
  }

  &--wrap {
    white-space: normal;
  }
}
</style>

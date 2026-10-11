<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'

/**
 * The note that goes with a list of training methods: the list is not complete, and how to get a
 * method added. On the website it opens the suggestion form (see useSuggestMethod); a copy on a
 * player's own machine has no form, so it links to the project's issues.
 */
const { skill = null } = defineProps<{
  /** The skill the suggestion form opens on; none when the list spans skills. */
  skill?: SkillKey | null
  /** The note follows the table it is about, and stands clear of it. */
  belowTable?: boolean
}>()

const suggestMethod = useSuggestMethod()

// Suggestions are filed by the website's server; a copy on a player's own machine has nowhere to send one.
const note = methodsNote(useAppMode() === 'hosted', useRuntimeConfig().public.githubRepo)
</script>

<template>
  <p class="note methods-note" :class="{ 'methods-note--below-table': belowTable }">
    {{ note.text }}
    <button
      v-if="note.suggestLabel"
      type="button"
      class="button button--small methods-note__action"
      @click="suggestMethod.open(skill)"
    >
      {{ note.suggestLabel }}
    </button>
    <a v-else-if="note.link" class="methods-note__link" :href="note.link.href" rel="noopener">{{
      note.link.label
    }}</a>
  </p>
</template>

<style lang="scss">
.methods-note {
  &--below-table {
    margin-top: 22px;
  }

  // the button follows the last sentence on the same line where there is room
  &__action {
    margin-left: 8px;
  }

  &__link {
    color: var(--color-text-muted);
  }
}
</style>

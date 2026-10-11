<script setup lang="ts">
/**
 * A line at the top of Tonight while there are questions about the account's quests waiting: how
 * many, why they matter, the way to them and a way to put them off. It is a status bar, not a
 * call to action: the deal button is Tonight's one primary action, so nothing here is yellow.
 */
const { count } = defineProps<{
  /** How many questions are waiting. */
  count: number
}>()

const emit = defineEmits<{
  /** The player does not want to be asked for now. */
  dismiss: []
}>()

const sentence = computed(() => questionsPrompt(count))
</script>

<template>
  <aside class="quests-prompt" aria-label="Questions about your quests">
    <p class="quests-prompt__sentence">{{ sentence }}</p>
    <div class="action-row">
      <NuxtLink class="button button--small" :to="questsTabPath('questions')">
        {{ count === 1 ? 'Answer it' : 'Answer them' }}
      </NuxtLink>
      <button type="button" class="button button--small button--ghost" @click="emit('dismiss')">
        Not now
      </button>
    </div>
  </aside>
</template>

<style lang="scss">
.quests-prompt {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 24px;
  padding: 12px 18px;
  border-radius: var(--radius);
  background: var(--color-panel);
  box-shadow: 0 0 0 1px var(--color-edge);

  &__sentence {
    color: var(--color-text);
    font-weight: 600;
  }

  @media (max-width: 760px) {
    padding: 12px 16px;
  }
}
</style>

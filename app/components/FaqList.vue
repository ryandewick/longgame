<script setup lang="ts">
import type { Question } from '#shared/domain/site'

/** Questions and their answers, each question in white above its answer. */
defineProps<{
  questions: readonly Question[]
}>()
</script>

<template>
  <dl class="faq-list">
    <template v-for="{ question, answer } in questions" :key="question">
      <dt class="faq-list__question">{{ question }}</dt>
      <dd class="faq-list__answer">{{ answer }}</dd>
    </template>
  </dl>
</template>

<style lang="scss">
.faq-list {
  margin: 0;

  &__question {
    margin-top: 16px;
    color: var(--color-text-strong);
    font-weight: 700;
  }

  &__answer {
    max-width: 62ch;
    margin: 4px 0 0;
    color: var(--color-text-muted);
  }
}
</style>

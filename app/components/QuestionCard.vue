<script setup lang="ts">
import type { PlanQuestion } from '#shared/domain/plan-questions'

/**
 * One question about a quest or a diary tier: how far through its round it is, the question,
 * what a yes would change (the hours it saves, or for a smaller question what it adds), and the
 * three ways out of it. Y and N answer while the card, or anything in it, has the focus; they
 * are heard nowhere else, so typing elsewhere is untouched.
 *
 * The card is the same element from one question to the next, so the focus stays where it was:
 * on the button just pressed, or on the card itself.
 */
const { question, step, total, setAsideCount } = defineProps<{
  question: PlanQuestion
  /** Which question this is, counting the ones answered this visit: 5 of 13. */
  step: number
  total: number
  /** How many other open quests and diary tiers are not being asked about. */
  setAsideCount: number
  /** What the answer before this one changed beyond its own quest; empty when nothing. */
  notice: string
}>()

const emit = defineEmits<{
  /** The player answered: true for "Yes, done", false for "Not yet". */
  answer: [done: boolean]
  /** The player put the rest of the questions off. */
  later: []
}>()

/** Past this many the marks would be too thin to tell apart; the count beside them says the same. */
const MOST_MARKS = 40

const wording = computed(() => questionWording(question.requirement))
/** The hours a yes would save. Null for a smaller question, which says what it adds instead. */
const saving = computed(() => savingFigure(question.hoursSaved))
const adds = computed(() => smallerQuestionAdds(question))
const opens = computed(() => listInWords(question.opens))
const setAside = computed(() => setAsideNote(setAsideCount))
const marks = computed(() => (total <= MOST_MARKS ? total : 0))

const card = useTemplateRef('card')

function answerByKey(event: KeyboardEvent): void {
  // a held key must not answer the questions that follow, and a shortcut of the browser's is not an answer
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 'y') emit('answer', true)
  else if (key === 'n') emit('answer', false)
}

defineExpose({
  /** Puts the focus on the card, so that Y and N answer straight away. The page is not scrolled. */
  focus: (): void => card.value?.focus({ preventScroll: true }),
})
</script>

<template>
  <section
    ref="card"
    class="question-card"
    tabindex="-1"
    aria-label="Question"
    @keydown="answerByKey"
  >
    <p class="question-card__step">
      <span>{{ stepLabel(step, total) }}</span>
      <span
        v-if="marks"
        class="question-card__marks"
        role="img"
        :aria-label="progressLabel(step - 1, total - step)"
      >
        <span
          v-for="place in marks"
          :key="place"
          class="question-card__mark"
          :class="{
            'question-card__mark--answered': place < step,
            'question-card__mark--current': place === step,
          }"
        />
      </span>
    </p>

    <h2 class="question-card__question">
      <span class="question-card__lead">{{ wording.lead }}</span>
      {{ wording.subject }}
    </h2>

    <div v-if="saving" class="question-card__gain">
      <span class="question-card__saving">
        <GameNumber size="headline">{{ saving.figure }}</GameNumber>
        <GameNumber tone="white">{{ saving.unit }}</GameNumber>
      </span>
      <p class="question-card__effect">
        faster to max if you have. It opens up
        <strong class="question-card__opens">{{ opens }}</strong
        >.
      </p>
    </div>
    <p v-else class="question-card__adds">{{ adds }}</p>

    <div class="question-card__actions">
      <button
        type="button"
        class="button button--primary question-card__answer"
        aria-keyshortcuts="y"
        @click="emit('answer', true)"
      >
        Yes, done
        <kbd class="question-card__key" aria-hidden="true">Y</kbd>
      </button>
      <button
        type="button"
        class="button question-card__answer"
        aria-keyshortcuts="n"
        @click="emit('answer', false)"
      >
        Not yet
        <kbd class="question-card__key" aria-hidden="true">N</kbd>
      </button>
      <button
        type="button"
        class="button button--ghost question-card__later"
        @click="emit('later')"
      >
        Finish later
      </button>
    </div>

    <p v-if="notice" class="question-card__notice">{{ notice }}</p>

    <p v-if="setAside" class="question-card__foot">
      <b class="question-card__foot-lead">{{ setAside.lead }}</b>
      {{ setAside.rest }}
    </p>
  </section>
</template>

<style lang="scss">
.question-card {
  padding: 28px 32px 26px;
  border-radius: var(--radius);
  background: var(--color-panel);
  box-shadow: 0 0 0 1px var(--color-edge);

  &__step {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    color: var(--color-text-faint);
    font-size: 13px;
    font-weight: 600;
  }

  // the marks share whatever the line has left, so a long run of questions stays on one line
  &__marks {
    display: flex;
    flex: 1;
    gap: 5px;
    min-width: 0;
  }

  // one mark a question: still to come, answered, or the one being asked (ringed, so it is not told by colour alone)
  &__mark {
    flex: 1;
    max-width: 18px;
    height: 6px;
    border-radius: var(--radius);
    background: var(--color-edge);

    &--answered {
      background: var(--color-text);
    }

    &--current {
      background: var(--color-text-strong);
      box-shadow: 0 0 0 2px var(--color-edge-strong);
    }
  }

  &__question {
    margin-top: 22px;
    font-size: 34px;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  &__lead {
    display: block;
    margin-bottom: 10px;
    color: var(--color-text-faint);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: 0;
  }

  &__gain {
    display: flex;
    align-items: flex-end;
    gap: 28px;
    margin-top: 18px;
  }

  &__saving {
    display: flex;
    flex: none;
    align-items: baseline;
    gap: 8px;
  }

  &__effect {
    max-width: 44ch;
    color: var(--color-text-muted);
  }

  &__opens {
    color: var(--color-text-strong);
    font-weight: 600;
  }

  // a smaller question has no figure: what it adds is said in its place, as the card's one fact
  &__adds {
    max-width: 52ch;
    margin-top: 18px;
    color: var(--color-text-strong);
    font-weight: 600;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 26px;
  }

  // the two answers are the same width, so neither looks like the smaller choice
  &__answer {
    min-width: 150px;
  }

  &__key {
    margin-left: 10px;
    font: 600 12px/1 var(--font-text);
    opacity: 0.6;
  }

  &__later {
    margin-left: auto;
  }

  // the two quiet lines under the answers: what the last answer also ticked, and what is not asked
  &__notice,
  &__foot {
    color: var(--color-text-faint);
    font-size: 13px;
  }

  &__notice {
    margin-top: 16px;
  }

  &__foot {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--color-edge);
  }

  &__foot-lead {
    color: var(--color-text-muted);
    font-weight: 600;
  }

  @media (max-width: 760px) {
    padding: 20px 16px 18px;

    // the marks take a line of their own, where they have the width to be told apart
    &__marks {
      flex-basis: 100%;
    }

    &__question {
      font-size: 26px;
    }

    // the figure over its sentence, where there is no room for them side by side
    &__gain {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    &__answer {
      flex: 1;
      min-width: 0;
    }

    &__later {
      margin-left: 0;
    }
  }
}
</style>

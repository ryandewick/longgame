<script setup lang="ts">
/**
 * The questions part of the Quests page: the card asking about one quest or diary tier, and
 * beside it the answers given so far and what is still to come. Which questions there are, in
 * which round and in what order, is the domain's (see shared/domain/plan-questions.ts): this
 * takes each answer to the account store, which works the questions out again.
 *
 * There are two rounds. The questions that save hours are asked first. When none of those is
 * left the page pauses, says the hours are right and offers the smaller questions, which the
 * player may answer now or leave. Only when both rounds are empty is it finished.
 */
const account = useAccountStore()
const { answers, recordAnswer, putOff, isAnsweringSmaller, answerSmaller } = useQuestionRun()

const plan = computed(() => account.planQuestions)

/** The round being asked now. None while the page is paused between the two, or finished. */
const round = computed<QuestionRound | null>(() => {
  if (plan.value.savingHours.length) return 'hours'
  return plan.value.smaller.length && isAnsweringSmaller.value ? 'smaller' : null
})
const waiting = computed(() =>
  round.value === 'hours' ? plan.value.savingHours : round.value ? plan.value.smaller : [],
)
const question = computed(() => waiting.value[0] ?? null)
/** How many smaller questions the pause offers; 0 when it is not a pause. */
const smallerOffered = computed(() => (round.value ? 0 : plan.value.smaller.length))
const pause = computed(() => smallerRoundNote(smallerOffered.value))

/** The answers of this visit that have not been undone on the tick list since. */
const standing = computed(() => answersStanding(answers.value, account.ticks))
const progress = computed(() =>
  roundProgress(standing.value, waiting.value.length, round.value ?? 'hours'),
)
const rows = computed(() => answerRows(standing.value, waiting.value))
const hoursNow = computed(() => account.maxProgress.hoursLeft)
const hoursBefore = computed(() => hoursNow.value + hoursTakenOff(standing.value))
const setAside = computed(() => setAsideNote(plan.value.setAsideCount))

/** What the last answer ticked beyond its own quest, shown until the next answer. */
const notice = shallowRef('')
/** What a screen reader is told after an answer. Empty until one is given, so arriving says nothing twice. */
const announcement = shallowRef('')

const card = useTemplateRef('card')
const resting = useTemplateRef('resting')

onMounted(() => card.value?.focus())

/** What comes after an answer, for the announcement: the next question, the pause, or nothing. */
function whatFollows(): AfterAnswer {
  if (question.value) return { question: question.value, ...progress.value }
  return smallerOffered.value ? { smallerLeft: smallerOffered.value } : null
}

async function answer(done: boolean): Promise<void> {
  const asked = question.value
  if (!asked) return
  const alsoTicked = account.answerQuestion(asked.requirement, done)
  const given: GivenAnswer = {
    requirement: asked.requirement,
    done,
    hoursSaved: asked.hoursSaved,
    alsoTicked,
  }
  recordAnswer(given)
  notice.value = alsoChangedNotice(given)

  // the store has already worked the questions out again
  announcement.value = answerAnnouncement(given, whatFollows())
  if (question.value) return
  // the card has gone, and the focus with it: it moves to what took the card's place
  await nextTick()
  resting.value?.focus({ preventScroll: true })
}

/** Starts the second round: the smaller questions, with a count of their own. */
async function answerSmallerNow(): Promise<void> {
  answerSmaller()
  notice.value = ''
  const next = question.value
  if (next) announcement.value = questionAnnouncement({ question: next, ...progress.value })
  // the card is back, and takes the focus the pause had
  await nextTick()
  card.value?.focus()
}

/** Leaves the questions for another time: Tonight, without its prompt to come back here. */
function finishLater(): void {
  putOff()
  void navigateTo('/')
}
</script>

<template>
  <div class="quest-questions">
    <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>

    <QuestionCard
      v-if="question"
      ref="card"
      :question="question"
      :step="progress.step"
      :total="progress.total"
      :set-aside-count="plan.setAsideCount"
      :notice="notice"
      @answer="answer"
      @later="finishLater"
    />
    <section v-else ref="resting" class="quest-questions__resting" tabindex="-1">
      <template v-if="pause">
        <h2 class="quest-questions__title">{{ pause.title }}</h2>
        <p v-if="standing.length" class="quest-questions__summary">
          {{ questionsDoneSummary(standing) }}
        </p>
        <p class="quest-questions__summary">{{ pause.left }} {{ pause.purpose }}</p>
        <p v-if="notice" class="quest-questions__more">{{ notice }}</p>
        <div class="action-row quest-questions__actions">
          <button type="button" class="button" @click="answerSmallerNow">
            {{ pause.answerLabel }}
          </button>
          <button type="button" class="button button--ghost" @click="finishLater">
            Finish for now
          </button>
        </div>
      </template>
      <template v-else>
        <h2 class="quest-questions__title">That is everything worth asking</h2>
        <p class="quest-questions__summary">{{ questionsDoneSummary(standing) }}</p>
        <p v-if="notice" class="quest-questions__more">{{ notice }}</p>
        <p class="quest-questions__more">
          <template v-if="setAside">
            <b class="quest-questions__more-lead">{{ setAside.lead }}</b>
            {{ setAside.rest }}
          </template>
          <template v-else>
            Long Game asks again if a quest or diary tier starts to matter, for example when you
            reach the level for a method it unlocks.
          </template>
        </p>
        <div class="action-row quest-questions__actions">
          <NuxtLink class="button" to="/">Back to Tonight</NuxtLink>
        </div>
      </template>
    </section>

    <QuestionAnswers
      v-if="rows.length"
      :rows="rows"
      :hours-now="hoursNow"
      :hours-before="hoursBefore"
    />
  </div>
</template>

<style lang="scss">
.quest-questions {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  align-items: start;
  gap: 48px;

  // what takes the card's place between the two rounds and once nothing is left to ask: the same
  // panel, with less in it
  &__resting {
    padding: 28px 32px 26px;
    border-radius: var(--radius);
    background: var(--color-panel);
    box-shadow: 0 0 0 1px var(--color-edge);
  }

  &__title {
    font-size: 24px;
    line-height: 1.1;
  }

  &__summary {
    max-width: 52ch;
    margin-top: 10px;
  }

  &__more {
    margin-top: 16px;
    color: var(--color-text-faint);
    font-size: 13px;
  }

  &__more-lead {
    color: var(--color-text-muted);
    font-weight: 600;
  }

  &__actions {
    margin-top: 22px;
  }

  @media (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }

  @media (max-width: 760px) {
    &__resting {
      padding: 20px 16px 18px;
    }
  }
}
</style>

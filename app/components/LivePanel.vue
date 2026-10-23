<script setup lang="ts">
import type { SessionBlock } from '#shared/types/session'
import { formatShortNumber } from '#shared/domain/format'

/**
 * The block to do now, on its skill's cape: what it is and what it should bring in, the bar to
 * the skill's next level, the buttons that run it, and its clock. A quest or diary step hangs the
 * quest point cape or the achievement diary cape and says why it was dealt; once its Done is
 * pressed it asks whether the player finished it (`asking`). A wildcard hangs a "?" where the
 * cape would be.
 */
const { block, asking = false } = defineProps<{
  block: SessionBlock
  /** The step's Done has been pressed: its clock is stopped, and the panel asks whether it was finished. */
  asking?: boolean
}>()

const emit = defineEmits<{
  /** Start the block's timer, or pause it. */
  toggle: []
  done: []
  /** Swap the block for another skill. Only a skill block offers it. */
  swap: []
  /** The answer to a step's question: true when the player finished it. */
  answer: [finished: boolean]
}>()

const account = useAccountStore()

const skill = computed(() => blockSkill(block))
const listIcon = computed(() => blockListIcon(block))
const fact = computed(() => blockFact(block, account.account))
const note = computed(() => blockNote(block))
const target = computed(() => blockTarget(block))
const isRunning = computed(() => block.runningSince !== null)

/** The cape a quest or diary step hangs, since no skill's cape is its own. */
const stepCape = computed(() =>
  listIcon.value
    ? milestoneCapeUrl(listIcon.value === 'diary' ? 'achievement-diary' : 'quest-point')
    : null,
)

/** The question a step asks once its Done is pressed. Its clock is stopped, so its time is all banked. */
const ask = computed(() =>
  asking && block.kind === 'quest' ? questStepAsk(block, block.elapsed) : null,
)

/** The skill's way to its next level. Only a skill block shows it, and not once the skill is 99. */
const level = computed(() => {
  if (block.kind !== 'skill') return null
  const progress = levelProgress(account.account.skills[block.skill])
  return progress && { skill: block.skill, ...progress }
})

const panel = useTemplateRef('panel')
const cape = useTemplateRef('cape')
const motion = useMotion()

// A block goes live: its cape drops into the swatch from above, and what the panel says rises in
// behind it, a line at a time.
motion.onMoment('live', () => {
  motion.arrive(cape.value, { yPercent: -115 }, { duration: 0.5, ease: 'power3.out' })
  motion.arrive(
    panel.value?.contentElements(),
    { y: 8, autoAlpha: 0 },
    { duration: 0.3, stagger: 0.03, delay: 0.1, ease: 'power2.out' },
  )
})
</script>

<template>
  <CapePanel ref="panel" :skill="skill" :list-icon="listIcon" :title="block.title">
    <template #swatch>
      <img v-if="skill" ref="cape" class="live-panel__cape" :src="capeImageUrl(skill)" alt="" />
      <img v-else-if="stepCape" ref="cape" class="live-panel__cape" :src="stepCape" alt="" />
      <GameNumber v-else class="live-panel__wildcard" tone="white" size="clock">?</GameNumber>
    </template>

    <template v-if="ask">
      <p class="live-panel__fact">{{ ask.fact }}</p>
      <p class="live-panel__note live-panel__question">{{ ask.question }}</p>
      <p class="live-panel__note">{{ ask.note }}</p>
    </template>
    <template v-else>
      <p class="live-panel__fact">{{ fact }}</p>
      <p v-if="note" class="live-panel__note">{{ note }}</p>
      <div v-if="level" class="live-panel__level">
        <XpBar class="live-panel__xp-bar" :skill="level.skill" :percent="level.percent" />
        <GameNumber tone="white">
          {{ formatShortNumber(level.xpToNextLevel) }} xp to level {{ level.nextLevel }}
        </GameNumber>
      </div>
    </template>

    <template #actions>
      <template v-if="ask">
        <button type="button" class="button button--primary" @click="emit('answer', true)">
          {{ ask.yes }}
        </button>
        <button type="button" class="button" @click="emit('answer', false)">Not yet</button>
      </template>
      <template v-else>
        <button type="button" class="button button--primary" @click="emit('toggle')">
          {{ isRunning ? 'Pause' : 'Start' }}
        </button>
        <button type="button" class="button" @click="emit('done')">Done</button>
        <button
          v-if="block.kind === 'skill'"
          type="button"
          class="button button--ghost"
          title="Swap this block for another skill"
          @click="emit('swap')"
        >
          Swap
        </button>
      </template>
    </template>

    <template #aside>
      <SessionClock class="live-panel__clock" :timers="[block]" size="clock" />
      <!-- a paused block's time is all banked, so this line never needs the ticking clock; a
           step that is asking has stopped for good, so it does not say paused -->
      <small class="live-panel__caption">
        {{ ask ? `of ${block.minutes} min` : clockCaption(block, block.elapsed) }}
      </small>
      <template v-if="target">
        <GameNumber class="live-panel__target" tone="white">{{ target }}</GameNumber>
        <small class="live-panel__caption live-panel__caption--target">this block</small>
      </template>
    </template>

    <template #progress>
      <BlockProgress :block="block" />
    </template>
  </CapePanel>
</template>

<style lang="scss">
.live-panel {
  // the cape hangs in the swatch, which cuts it off at the hem
  &__cape {
    position: absolute;
    top: 14px;
    left: calc(50% - 63px);
    width: 126px;
    filter: drop-shadow(var(--shadow-cape-hanging));
  }

  &__wildcard {
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    // half its own height, to sit in the middle
    margin-top: -32px;
    text-align: center;
  }

  &__fact {
    font-weight: 600;
  }

  &__note {
    max-width: 54ch;
    margin-top: 4px;
    color: var(--color-text-muted);
  }

  // what a step's Done asks, a step up from the notes around it
  &__question {
    margin-top: 6px;
    color: var(--color-text-strong);
    font-weight: 600;
  }

  &__level {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-top: 14px;
  }

  &__xp-bar {
    flex: 0 1 250px;
    min-width: 120px;
  }

  &__clock,
  &__target {
    display: block;
  }

  &__target {
    margin-top: 14px;
  }

  &__caption {
    display: block;
    margin-top: 4px;
    color: var(--color-text-muted);
    font: 500 13px/1.3 var(--font-text);

    &--target {
      margin-top: 3px;
    }
  }

  @media (max-width: 760px) {
    &__cape {
      top: 8px;
      left: calc(50% - 46px);
      width: 92px;
    }
  }
}
</style>

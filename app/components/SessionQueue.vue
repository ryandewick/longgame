<script setup lang="ts">
import type { Session } from '#shared/types/session'

/**
 * Tonight's session as slots in running order, then the two ways out of it (finish and tally,
 * or deal again) beside how its planned and logged time compare with what the player asked for.
 */
const { session } = defineProps<{
  session: Session
  /** The place of the block to do now; null once every block is done. */
  liveBlockIndex: number | null
  /** The session is being finished: its stats are on their way, so the ways out are closed. */
  finishing?: boolean
}>()

const emit = defineEmits<{
  /** Start a block's timer, by its place in the session. */
  toggle: [blockIndex: number]
  done: [blockIndex: number]
  swap: [blockIndex: number]
  finish: []
  redeal: []
}>()

const overrun = computed(() => overrunWarning(session))

const slotList = useTemplateRef('slotList')
const motion = useMotion()

/** The slots as they lie in the list, which is the order of the session's blocks. */
function slots(): Element[] {
  return Array.from(slotList.value?.children ?? [])
}

// a deal: the slots rise in, one after another
motion.onMoment('deal', () => {
  motion.arrive(
    slots(),
    { y: 14, autoAlpha: 0 },
    { duration: 0.35, stagger: 0.06, ease: 'power2.out' },
  )
})

// a swap: the slot that changed flips down from its top edge
motion.onMoment('swap', ({ blockIndex }) => {
  motion.arrive(
    slots()[blockIndex],
    { rotationX: -80, transformOrigin: '50% 0' },
    { duration: 0.4, ease: 'power2.out' },
  )
})
</script>

<template>
  <section class="session-queue">
    <div class="section-heading">
      <h3 class="section-heading__title">Tonight’s session</h3>
      <span class="section-heading__aside">{{ sessionSummary(session) }}</span>
    </div>

    <!-- named a list outright: some browsers stop announcing one once its markers are styled away -->
    <ol ref="slotList" class="session-queue__slots" role="list">
      <!-- a session's blocks keep their places, so a block's place is its identity -->
      <SessionSlot
        v-for="(block, blockIndex) in session.blocks"
        :key="blockIndex"
        :block="block"
        :live="blockIndex === liveBlockIndex"
        @toggle="emit('toggle', blockIndex)"
        @done="emit('done', blockIndex)"
        @swap="emit('swap', blockIndex)"
      />
    </ol>

    <div class="session-queue__actions action-row">
      <button type="button" class="button" :disabled="finishing" @click="emit('finish')">
        Finish session and tally
      </button>
      <button
        type="button"
        class="button button--ghost"
        :disabled="finishing"
        @click="emit('redeal')"
      >
        Deal again
      </button>
      <span class="note">
        {{ plannedMinutes(session) }} of {{ session.minutes }} min planned,
        <SessionClock :timers="session.blocks" tone="white" />
        logged
      </span>
      <span v-if="overrun" class="session-queue__overrun">{{ overrun }}</span>
    </div>
  </section>
</template>

<style lang="scss">
.session-queue {
  &__slots {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__actions {
    margin-top: 18px;
  }

  &__overrun {
    color: var(--color-warning);
    font-size: 13px;
  }
}
</style>

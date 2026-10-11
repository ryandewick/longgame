<script setup lang="ts">
import type { Session } from '#shared/types/session'

/**
 * What takes the live block's place once every block is done: the reminder to log out first,
 * and the button that fetches the stats and tallies the session.
 */
const { session } = defineProps<{
  session: Session
  /** The session is being finished: its stats are on their way. */
  finishing?: boolean
}>()

const emit = defineEmits<{
  finish: []
  redeal: []
}>()

const fannedCapes = computed(() => capesOfSession(session))
</script>

<template>
  <CapePanel
    :skill="null"
    title="Finish and tally"
    note="Every block is done. Log out or hop worlds first so the hiscores catch up, then finish and the gains are counted."
  >
    <template #swatch>
      <CapeFan :skills="fannedCapes" />
    </template>
    <template #actions>
      <button
        type="button"
        class="button button--primary"
        :disabled="finishing"
        @click="emit('finish')"
      >
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
    </template>
  </CapePanel>
</template>

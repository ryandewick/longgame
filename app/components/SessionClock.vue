<script setup lang="ts">
import type { BlockTimer } from '#shared/types/session'
import { formatClock } from '#shared/domain/format'

/**
 * A stopwatch reading that keeps time: one block's clock, or several blocks added up for the
 * session's total. It reads the ticking time itself, so each second only this text is drawn
 * again and not the panel around it; with every timer paused it does not change at all.
 */
const {
  timers,
  tone = 'stat',
  size = 'text',
} = defineProps<{
  /** The timers to add up. */
  timers: readonly BlockTimer[]
  tone?: 'stat' | 'white'
  size?: 'text' | 'clock'
}>()

const now = useNow()

const reading = computed(() =>
  formatClock(timers.reduce((total, timer) => total + elapsedOnScreen(timer, now.value), 0)),
)
</script>

<template>
  <GameNumber :tone="tone" :size="size" role="timer">{{ reading }}</GameNumber>
</template>

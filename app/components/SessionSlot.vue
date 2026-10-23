<script setup lang="ts">
import type { SessionBlock } from '#shared/types/session'
import { formatClock } from '#shared/domain/format'

/**
 * One block of tonight's session, as an item of the list of slots: what it is, how long it runs
 * and what it should bring in, or "Done" with the time it took. A block that is waiting has its
 * own small buttons; the live block has none, because the live panel holds them.
 */
const { block } = defineProps<{
  block: SessionBlock
  /** This is the block to do now: it is outlined and leaves its buttons to the live panel. */
  live?: boolean
}>()

const emit = defineEmits<{
  /** Start the block's timer, which makes it the live block. */
  toggle: []
  done: []
  /** Swap the block for another skill. Only a skill block offers it. */
  swap: []
}>()

const skill = computed(() => blockSkill(block))
const listIcon = computed(() => blockListIcon(block))
const hasTime = computed(() => block.elapsed > 0)
</script>

<template>
  <li
    class="session-slot"
    :class="{ 'session-slot--live': live }"
    :aria-current="live ? 'step' : undefined"
  >
    <span class="session-slot__title" :class="{ 'session-slot__title--done': block.done }">
      {{ block.title }}
    </span>
    <SkillIcon
      class="session-slot__icon"
      :skill="skill"
      :list-icon="listIcon"
      :wildcard="block.kind === 'wildcard'"
    />
    <span class="session-slot__caption">{{ slotCaption(block) }}</span>

    <div class="session-slot__status">
      <template v-if="block.done">
        <GameNumber tone="due">Done</GameNumber>
        <GameNumber v-if="hasTime" tone="white">{{ formatClock(block.elapsed) }}</GameNumber>
      </template>
      <template v-else>
        <GameNumber>{{ slotPlan(block) }}</GameNumber>
        <!-- the live block's time is on the big clock -->
        <GameNumber v-if="hasTime && !live" tone="white">
          {{ formatClock(block.elapsed) }} logged
        </GameNumber>
      </template>
    </div>

    <div v-if="!block.done && !live" class="session-slot__actions">
      <button
        type="button"
        class="button button--small"
        :aria-label="`${hasTime ? 'Resume' : 'Start'} ${block.title}`"
        @click="emit('toggle')"
      >
        {{ hasTime ? 'Resume' : 'Start' }}
      </button>
      <button
        type="button"
        class="button button--small button--ghost"
        :aria-label="`Done with ${block.title}`"
        @click="emit('done')"
      >
        Done
      </button>
      <button
        v-if="block.kind === 'skill'"
        type="button"
        class="button button--small button--ghost"
        :aria-label="`Swap ${block.title}`"
        title="Swap this block for another skill"
        @click="emit('swap')"
      >
        Swap
      </button>
    </div>
  </li>
</template>

<style lang="scss">
.session-slot {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  align-content: start;
  gap: 2px 8px;
  padding: 12px 12px 11px;
  border-radius: var(--radius);
  background: var(--color-slot);
  // a highlight along the top and a dark line around it
  box-shadow:
    inset 0 1px 0 var(--color-raised),
    0 0 0 1px var(--color-slot-edge);

  // the one place a surface is outlined in stat yellow: the block to do now
  &--live {
    box-shadow: 0 0 0 2px var(--color-stat);
  }

  &__title {
    color: var(--color-text-strong);
    font-weight: 700;
    line-height: 1.2;

    &--done {
      color: var(--color-text-muted);
    }
  }

  // beside the title and the caption under it
  &__icon {
    grid-row: 1 / 3;
    grid-column: 2;
    justify-self: end;
  }

  &__caption {
    color: var(--color-text-faint);
    font-size: 13px;
  }

  &__status {
    display: flex;
    flex-wrap: wrap;
    grid-column: 1 / -1;
    gap: 10px;
    margin-top: 8px;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    grid-column: 1 / -1;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
  }
}
</style>

<script setup lang="ts">
/**
 * A long list of quests to tick, with a search box and a filter over it: the quests that unlock
 * nothing and are ticked for their XP. Each row is a tick box, the quest's name and what it pays.
 */
const { rows } = defineProps<{
  rows: readonly QuestRow[]
}>()

const emit = defineEmits<{
  /** The player ticked this quest, or unticked it. */
  toggle: [questName: string]
}>()

const search = shallowRef('')
const filter = shallowRef<QuestFilter>('all')
const searchId = useId()

const shown = computed(() => filterQuestRows(rows, search.value, filter.value))
</script>

<template>
  <div class="quest-checklist">
    <div class="quest-checklist__tools">
      <label class="visually-hidden" :for="searchId">Search quests</label>
      <input
        :id="searchId"
        v-model="search"
        class="input"
        type="search"
        placeholder="Search quests"
        autocomplete="off"
        spellcheck="false"
      />
      <ChipGroup v-model="filter" label="Show" :options="QUEST_FILTER_OPTIONS" />
    </div>

    <!-- named a list outright: some browsers stop announcing one once its markers are styled away -->
    <ul v-if="shown.length" class="quest-checklist__list" role="list">
      <li v-for="row in shown" :key="row.name" class="quest-checklist__row">
        <TickBox
          class="quest-checklist__tick"
          :ticked="row.done"
          :label="`${row.name}, ${row.done ? 'done' : 'not done'}`"
          @toggle="emit('toggle', row.name)"
        >
          <span class="quest-checklist__name" :class="{ 'quest-checklist__name--done': row.done }">
            {{ row.name }}
          </span>
        </TickBox>
        <span class="quest-checklist__xp">{{ row.xp }}</span>
      </li>
    </ul>
    <p v-else class="note" role="status">No quest matches.</p>
  </div>
</template>

<style lang="scss">
.quest-checklist {
  &__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  &__list {
    margin: 0;
    padding: 0;
    columns: 4;
    column-gap: 14px;
    list-style: none;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    break-inside: avoid;
  }

  // the tick box takes the room the XP leaves, so a long name is cut short and not the figure
  &__tick {
    flex: 1;
  }

  &__name {
    display: block;
    overflow: hidden;
    color: var(--color-text);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--done {
      color: var(--color-text-strong);
    }
  }

  &__xp {
    flex: none;
    color: var(--color-text-faint);
    font-size: 13px;
    font-variant-numeric: tabular-nums lining-nums;
  }

  @media (max-width: 1100px) {
    &__list {
      columns: 2;
    }
  }

  @media (max-width: 760px) {
    &__list {
      columns: 1;
    }
  }
}
</style>

<script setup lang="ts">
import { skillName } from '#shared/data/skills'

/**
 * The quests that unlock something the planner deals: each with a tick box, what it opens up and
 * the icons of the skills that trains. Two columns that read downwards, one on a narrow screen.
 */
defineProps<{
  quests: readonly UnlockRow[]
}>()

const emit = defineEmits<{
  /** The player ticked this quest, or unticked it. */
  toggle: [questName: string]
}>()
</script>

<template>
  <!-- named a list outright: some browsers stop announcing one once its markers are styled away -->
  <ul class="unlock-list" role="list">
    <li
      v-for="(quest, index) in quests"
      :key="quest.name"
      class="unlock-list__row"
      :class="{ 'unlock-list__row--banded': index % 2 === 0 }"
    >
      <TickBox
        class="unlock-list__tick"
        :ticked="quest.done"
        :label="`${quest.name}, ${quest.done ? 'done' : 'not done'}`"
        @toggle="emit('toggle', quest.name)"
      >
        <b class="unlock-list__name" :class="{ 'unlock-list__name--done': quest.done }">
          {{ quest.name }}
        </b>
        <span class="unlock-list__opens">{{ quest.opens }}</span>
      </TickBox>
      <span v-if="quest.skills.length" class="unlock-list__skills">
        <SkillIcon
          v-for="skill in quest.skills"
          :key="skill"
          :skill="skill"
          :title="skillName(skill)"
        />
        <span v-if="quest.moreSkills" class="unlock-list__more">+{{ quest.moreSkills }}</span>
      </span>
    </li>
  </ul>
</template>

<style lang="scss">
.unlock-list {
  margin: 0;
  padding: 0;
  columns: 2;
  column-gap: 14px;
  list-style: none;

  &__row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: var(--radius);
    break-inside: avoid;

    &--banded {
      background: var(--color-slot);
    }
  }

  // the tick box takes the room the icons leave, so a long name is cut short and not the icons
  &__tick {
    flex: 1;
  }

  &__name,
  &__opens {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__name {
    color: var(--color-text);
    font-weight: 700;
    line-height: 1.25;

    &--done {
      color: var(--color-text-strong);
    }
  }

  &__opens {
    color: var(--color-text-faint);
    font-size: 13px;
    line-height: 1.3;
  }

  &__skills {
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
  }

  // how many more skills it trains than there is room to show
  &__more {
    margin-left: 4px;
    color: var(--color-text-faint);
    font-size: 13px;
  }

  @media (max-width: 760px) {
    columns: 1;
  }
}
</style>

<script setup lang="ts">
import { skillName } from '#shared/data/skills'
import { formatShortNumber } from '#shared/domain/format'
import {
  describeLevelsShort,
  describeQuestRewards,
  questRewardSkills,
  type QuestOffer,
} from '#shared/domain/quests'

/**
 * The quests still worth doing for their XP, in the order given: what each pays and to which
 * skills, the levels the account is short of for it, and a button to tick it done.
 */
const { offers } = defineProps<{
  offers: readonly QuestOffer[]
}>()

const emit = defineEmits<{
  /** The player has done this quest. */
  complete: [questName: string]
}>()

const rows = computed(() =>
  offers.map(({ quest, totalXp, levelsShort }, index) => ({
    name: quest.name,
    rewardSkills: questRewardSkills(quest),
    rewards: describeQuestRewards(quest),
    // a miniquest or an activity says so beside its rewards; a quest says nothing
    kindAside:
      quest.kind === 'miniquest' ? 'Miniquest.' : quest.kind === 'activity' ? 'Activity.' : '',
    levelsShort: describeLevelsShort(levelsShort),
    totalXp: totalXp ? formatShortNumber(totalXp) : '',
    isBanded: index % 2 === 1,
  })),
)
</script>

<template>
  <table class="data-table quest-xp-table">
    <thead>
      <tr>
        <th class="data-table__heading" scope="col">Quest</th>
        <th class="data-table__heading data-table__heading--number" scope="col">XP</th>
        <th class="data-table__heading" scope="col">
          <span class="visually-hidden">Mark done</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.name"
        class="data-table__row"
        :class="{ 'data-table__row--banded': row.isBanded }"
      >
        <td class="data-table__cell data-table__cell--top">
          <b class="data-table__title">{{ row.name }}</b>
          <span v-if="row.rewardSkills.length" class="data-table__detail">
            <SkillIcon
              v-for="skill in row.rewardSkills"
              :key="skill"
              :skill="skill"
              :title="skillName(skill)"
            />
          </span>
          <span class="data-table__detail">
            {{ row.rewards }}
            <em v-if="row.kindAside" class="quest-xp-table__aside quest-xp-table__aside--quiet">
              {{ row.kindAside }}
            </em>
            <em v-if="row.levelsShort" class="data-table__needs quest-xp-table__aside">
              Short of {{ row.levelsShort }}.
            </em>
          </span>
        </td>
        <td class="data-table__cell data-table__cell--top data-table__cell--number">
          <GameNumber v-if="row.totalXp">{{ row.totalXp }}</GameNumber>
        </td>
        <td class="data-table__cell data-table__cell--top data-table__cell--actions">
          <button
            type="button"
            class="button button--small"
            :aria-label="`Mark done: ${row.name}`"
            @click="emit('complete', row.name)"
          >
            Mark done
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style lang="scss">
.quest-xp-table {
  // a remark on a line of its own under the rewards: "Miniquest.", "Short of 70 Mining."
  &__aside {
    display: block;
    font-style: normal;

    &--quiet {
      color: var(--color-text-faint);
    }
  }
}
</style>

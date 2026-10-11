<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { QUESTS } from '#shared/data/quests'
import { skillName } from '#shared/data/skills'

/**
 * One skill in full: its crest, where it stands and what to do about it in a few sentences, and
 * beside them every method it has. Skills shows it for the row that is open; Methods shows it
 * for the skill picked.
 */
const { skill, headingTag = 'h3' } = defineProps<{
  skill: SkillKey
  /** The level the skill's name takes in the page's outline: under "Skills" it is an h3. */
  headingTag?: 'h2' | 'h3'
}>()

const account = useAccountStore()
const history = useHistoryStore()
const headingId = useId()

const insight = computed(() => account.skillInsights[skill])

const paragraphs = computed(() =>
  skillDetailParagraphs(
    insight.value,
    account.isIronman,
    history.pace(SKILL_PACE_DAYS, skill).xpPerDay,
    questsOwingXp(account.account, skill, QUESTS),
  ),
)
</script>

<template>
  <section class="skill-detail" :aria-labelledby="headingId">
    <div class="skill-detail__summary">
      <SkillCrest :skill="skill" :level="insight.stat.level" />
      <component :is="headingTag" :id="headingId" class="skill-detail__name">
        <SkillIcon :skill="skill" size="large" />
        {{ skillName(skill) }}
      </component>
      <div class="skill-detail__sentences">
        <p
          v-for="(paragraph, paragraphIndex) in paragraphs"
          :key="paragraphIndex"
          class="skill-detail__paragraph"
        >
          <template v-for="(segment, segmentIndex) in paragraph" :key="segmentIndex">
            <b v-if="segment.strong" class="skill-detail__strong">{{ segment.text }}</b>
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>
      </div>
    </div>
    <MethodsTable
      v-if="insight.methods.length"
      :methods="insight.methods"
      :best-method="insight.fastestMethod"
      :is-ironman="account.isIronman"
    />
  </section>
</template>

<style lang="scss">
.skill-detail {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(0, 2fr);
  align-items: start;
  gap: 40px;

  &__name {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 16px 0 12px;
    font-size: 30px;
    line-height: 1;
  }

  &__sentences {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__paragraph {
    max-width: 48ch;
    color: var(--color-text-muted);
  }

  &__strong {
    color: var(--color-text-strong);
    font-weight: 600;
  }

  // one column once the table would be squeezed: the summary first, the methods under it
  @media (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}
</style>

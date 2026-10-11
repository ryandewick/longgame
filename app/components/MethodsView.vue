<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { METHODS } from '#shared/data/methods'
import { SKILL_KEYS, skillName } from '#shared/data/skills'

/**
 * Methods: every training method of one skill, with what the account is missing for each.
 */
const { selectedSkill } = defineProps<{
  /** The skill named in the address (/methods/mining), or null when none is. */
  selectedSkill: SkillKey | null
}>()

/** The skills that have methods to list, in hiscores order. A skill trained by combat alone has none. */
const SKILL_OPTIONS = SKILL_KEYS.filter((skill) => METHODS[skill].length > 0).map((skill) => ({
  value: skill,
  label: skillName(skill),
}))

/** The skill on show: the one in the address when it has methods, otherwise the first that does. */
const pickedSkill = computed<SkillKey | null>(() => {
  const named = SKILL_OPTIONS.find((option) => option.value === selectedSkill)
  return (named ?? SKILL_OPTIONS[0])?.value ?? null
})

/** The address changes in place: the skill on show is a state of this page, not somewhere new. */
function pick(skill: SkillKey): void {
  void navigateTo(`/methods/${skill}`, { replace: true })
}
</script>

<template>
  <div class="methods-view">
    <div class="section-heading section-heading--first">
      <h1 class="section-heading__title section-heading__title--page">Methods</h1>
      <span class="section-heading__aside">Every method, with what your account is missing.</span>
    </div>
    <MethodsNote class="methods-view__note" :skill="pickedSkill" />
    <template v-if="pickedSkill">
      <ChipGroup
        class="methods-view__picker"
        label="Skill"
        :options="SKILL_OPTIONS"
        :model-value="pickedSkill"
        @update:model-value="pick"
      >
        <template #option="{ option }">
          <SkillIcon :skill="option.value" size="chip" />
          {{ option.label }}
        </template>
      </ChipGroup>
      <SkillDetail :skill="pickedSkill" heading-tag="h2" />
    </template>
  </div>
</template>

<style lang="scss">
.methods-view {
  &__note {
    margin-bottom: 16px;
  }

  &__picker {
    margin-bottom: 36px;
  }
}
</style>

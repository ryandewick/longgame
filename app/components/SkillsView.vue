<script setup lang="ts">
import type { SkillSort } from '#shared/domain/save'
import type { SkillKey } from '#shared/types/skill'
import { SKILL_KEYS } from '#shared/data/skills'

/**
 * Skills: every skill as a line from 1 to 99 with what is left of it, and the detail of the skill picked
 * from the list or from the rack.
 */
const { selectedSkill, revealOnArrival = false } = defineProps<{
  /** The skill named in the address (/skills/mining), or null when none is. */
  selectedSkill: SkillKey | null
  /**
   * The player came here from another page by picking a skill (a cape on the rack), so the page
   * opens at that skill's detail and not at the top of the table above it.
   */
  revealOnArrival?: boolean
}>()

const SORT_OPTIONS: readonly { readonly value: SkillSort; readonly label: string }[] = [
  { value: 'hours', label: 'Most work left' },
  { value: 'level', label: 'Lowest level' },
  { value: 'name', label: 'A to Z' },
]

const account = useAccountStore()
const history = useHistoryStore()

const sort = computed<SkillSort>({
  get: () => account.preferences.skillSort,
  set: (order) => account.setPreference('skillSort', order),
})

const rows = computed(() => {
  const insights = SKILL_KEYS.map((skill) => account.skillInsights[skill])
  return sortSkillInsights(insights, sort.value).map((insight) =>
    skillRow(insight, history.pace(SKILL_PACE_DAYS, insight.skill).xpPerDay, account.isIronman),
  )
})

/**
 * Picking a row opens its skill; picking the open row closes it. The address changes in place:
 * the skill on show is a state of this page, not somewhere new to come back from.
 */
function select(skill: SkillKey): void {
  void navigateTo(skill === selectedSkill ? '/skills' : `/skills/${skill}`, { replace: true })
}

const detail = useTemplateRef('detail')

/** Brings the detail on screen, moving the page no further than it has to. */
function revealDetail(behavior: ScrollBehavior): void {
  detail.value?.scrollIntoView({ behavior, block: 'nearest' })
}

// The detail opens under a table two screens long, so a skill picked from a row or from the rack
// would otherwise open out of sight.
watch(
  () => selectedSkill,
  async (skill) => {
    if (!skill) return
    await nextTick()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    revealDetail(reducedMotion ? 'auto' : 'smooth')
  },
)

onMounted(() => {
  if (revealOnArrival && selectedSkill) revealDetail('auto')
})
</script>

<template>
  <div class="skills-view">
    <div class="section-heading section-heading--first">
      <h2 class="section-heading__title section-heading__title--page">Skills</h2>
      <ChipGroup v-model="sort" label="Sort skills by" :options="SORT_OPTIONS" />
    </div>
    <SkillsTable :rows="rows" :selected-skill="selectedSkill" @select="select" />
    <div v-if="selectedSkill" ref="detail" class="skills-view__detail">
      <SkillDetail :skill="selectedSkill" />
    </div>
  </div>
</template>

<style lang="scss">
.skills-view {
  &__detail {
    margin-top: 36px;
    // clear of the top bar, which stays on screen
    scroll-margin-top: 84px;
  }
}
</style>

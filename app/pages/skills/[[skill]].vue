<script setup lang="ts">
import { isSkillKey } from '#shared/data/skills'

definePageMeta({
  // /skills and /skills/mining are one page: picking a skill must not rebuild it, run the change-of-page
  // transition or jump back to the top. Arriving from another page with a skill picked does not start at
  // the top either: the page opens at that skill's detail (see SkillsView).
  key: 'skills',
  scrollToTop: (to, from) => to.name !== from.name && !to.params.skill,
  validate: ({ params }) =>
    !params.skill || (typeof params.skill === 'string' && isSkillKey(params.skill)),
})

useHead({ title: 'Skills' })

const selectedSkill = useRouteSkill()

// A page the server drew is being opened at its address and starts at the top like any other. One
// built in the browser was reached by a link from inside the app: with a skill in the address that
// is a cape picked from another page's rack, so the page opens at that skill's detail.
const arrivedFromInsideTheApp = !useNuxtApp().isHydrating
</script>

<template>
  <PlannerPage rack :current-skill="selectedSkill">
    <SkillsView :selected-skill="selectedSkill" :reveal-on-arrival="arrivedFromInsideTheApp" />
  </PlannerPage>
</template>

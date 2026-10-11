<script setup lang="ts">
import { isSkillKey } from '#shared/data/skills'

definePageMeta({
  // /methods and /methods/mining are one page: picking a skill must not rebuild it, run the change-of-page
  // transition or jump back to the top
  key: 'methods',
  scrollToTop: (to, from) => to.name !== from.name,
  validate: ({ params }) =>
    !params.skill || (typeof params.skill === 'string' && isSkillKey(params.skill)),
})

useHead({ title: 'Methods' })

const selectedSkill = useRouteSkill()
</script>

<template>
  <PlannerPage>
    <MethodsView :selected-skill="selectedSkill" />
  </PlannerPage>
</template>

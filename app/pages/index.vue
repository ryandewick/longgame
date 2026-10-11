<script setup lang="ts">
useHead({ title: 'Tonight' })

const session = useSessionStore()
</script>

<template>
  <PlannerPage rack :current-skill="session.liveSkill">
    <TonightView />
  </PlannerPage>
</template>

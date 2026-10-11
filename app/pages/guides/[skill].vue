<script setup lang="ts">
import { GUIDES_PATH, buildSkillGuide, isGuideSkill } from '#shared/domain/guides'

/** The guide to one skill: every way to train it, from the method data. */
definePageMeta({
  layout: 'guide',
  // only a skill with methods has a guide; anything else is the "not found" page
  validate: ({ params }) => typeof params.skill === 'string' && isGuideSkill(params.skill),
})

// A guide is built once, for the skill in the address: another skill's guide is another page.
const { skill } = useRoute().params
if (typeof skill !== 'string' || !isGuideSkill(skill)) {
  throw createError({ status: 404, statusText: 'Page not found', fatal: true })
}
const guide = buildSkillGuide(skill)
const crumbs: Crumb[] = [
  { label: 'Long Game', path: '/' },
  { label: 'Training guides', path: GUIDES_PATH },
  { label: guide.name },
]
const { siteUrl } = useRuntimeConfig().public

usePageSeo({
  title: guide.title,
  description: guide.description,
  path: guide.path,
  structuredData: buildSkillGuideStructuredData(siteUrl, guide, crumbs),
})
</script>

<template>
  <div>
    <GuideCrumbs :crumbs="crumbs" />
    <GuideHeader
      :skill="guide.skill"
      :heading="guide.heading"
      :paragraphs="[guide.facts, guide.highlights]"
    />
    <GuideCallToAction />
    <GuideMethodsTable :methods="guide.methods" />
    <MethodsNote :skill="guide.skill" below-table />
    <GuideSources :sources="guide.sources" />
  </div>
</template>

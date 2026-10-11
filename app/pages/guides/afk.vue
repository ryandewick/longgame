<script setup lang="ts">
import { GUIDES_PATH, buildAfkGuide } from '#shared/domain/guides'

/** Every AFK training method across all skills, in one table. */
definePageMeta({ layout: 'guide' })

const guide = buildAfkGuide()
const crumbs: Crumb[] = [
  { label: 'Long Game', path: '/' },
  { label: 'Training guides', path: GUIDES_PATH },
  { label: 'AFK' },
]
const { siteUrl } = useRuntimeConfig().public

usePageSeo({
  title: guide.title,
  description: guide.description,
  path: guide.path,
  structuredData: buildTrailStructuredData(siteUrl, crumbs, guide.path),
})
</script>

<template>
  <div>
    <GuideCrumbs :crumbs="crumbs" />
    <GuideHeader :heading="guide.heading" :paragraphs="[guide.facts]" />
    <GuideCallToAction />
    <GuideMethodsTable :methods="guide.methods" show-skill />
    <MethodsNote below-table />
    <GuideSources :sources="guide.sources" />
  </div>
</template>

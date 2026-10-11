<script setup lang="ts">
import { buildGuideIndex } from '#shared/domain/guides'

/** The index of the training guides: every skill with how many methods its guide holds, and the AFK page. */
definePageMeta({ layout: 'guide' })

const index = buildGuideIndex()
const crumbs: Crumb[] = [{ label: 'Long Game', path: '/' }, { label: 'Training guides' }]
const { siteUrl } = useRuntimeConfig().public

usePageSeo({
  title: index.title,
  description: index.description,
  path: index.path,
  structuredData: buildTrailStructuredData(siteUrl, crumbs, index.path),
})
</script>

<template>
  <div>
    <GuideCrumbs :crumbs="crumbs" />
    <GuideHeader :heading="index.heading" :paragraphs="[index.facts]" />
    <GuideLinks :links="index.links" />
    <GuideCallToAction />
  </div>
</template>

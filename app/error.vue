<script setup lang="ts">
import type { NuxtError } from '#app'
import { GUIDES_PATH } from '#shared/domain/guides'

/**
 * What is shown in place of a page that cannot be: an address that matches nothing (the "not
 * found" page, which the build also writes out as 404.html), or a page that failed to load.
 * It wears the public pages' frame and offers the two ways back in.
 */
const { error } = defineProps<{
  error: NuxtError
}>()

const isNotFound = computed(() => error.statusCode === 404)
const heading = computed(() => (isNotFound.value ? 'That page is not here' : 'That did not load'))
const explanation = computed(() =>
  isNotFound.value
    ? 'The address may be wrong, or the page may have moved.'
    : 'Something went wrong on the way. Try again in a moment.',
)

useHead({
  title: () =>
    isNotFound.value ? 'Page not found | Long Game' : 'Something went wrong | Long Game',
  titleTemplate: null,
  meta: [
    { name: 'description', content: 'That page does not exist.' },
    // an error is not a page of the site: nothing here should be listed by a search engine
    { name: 'robots', content: 'noindex' },
  ],
})
</script>

<template>
  <NuxtLayout name="guide">
    <GuideHeader :heading="heading" :paragraphs="[explanation]" />
    <GuideCallToAction>
      <NuxtLink class="button" :to="GUIDES_PATH">Training guides</NuxtLink>
    </GuideCallToAction>
  </NuxtLayout>
</template>

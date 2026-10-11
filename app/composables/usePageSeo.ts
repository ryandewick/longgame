import type { MaybeRefOrGetter } from 'vue'

/**
 * Gives a public page its head: title, description, canonical address, link preview tags and
 * structured data, with the site's address taken from `runtimeConfig.public.siteUrl`. The tags
 * go when the component that asked for them does.
 */
export function usePageSeo(page: MaybeRefOrGetter<PageSeo>): void {
  const { siteUrl } = useRuntimeConfig().public
  useHead(() => buildPageHead(siteUrl, toValue(page)))
}

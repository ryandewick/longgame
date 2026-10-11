import { buildSitemap } from '#shared/domain/site'

/** GET /sitemap.xml: the address of every public page, for search engines. Written out as a file when the site is built. */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return buildSitemap(useRuntimeConfig(event).public.siteUrl)
})

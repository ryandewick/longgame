import { buildRobots } from '#shared/domain/site'

/** GET /robots.txt: crawlers may read everything but the API, and here is the sitemap. */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return buildRobots(useRuntimeConfig(event).public.siteUrl)
})

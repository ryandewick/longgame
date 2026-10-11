import { buildLlmsSummary } from '#shared/domain/site'

/** GET /llms.txt: the site described for AI assistants, with a link to every page and to the data. */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return buildLlmsSummary(useRuntimeConfig(event).public.siteUrl)
})

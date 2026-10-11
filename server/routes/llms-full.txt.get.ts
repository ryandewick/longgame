import { buildLlmsFull } from '#shared/domain/site'

/** GET /llms-full.txt: every training method as text tables, for an AI assistant that wants all of it. */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return buildLlmsFull()
})

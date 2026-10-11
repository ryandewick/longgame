import { apiError, valueOrThrow } from '../utils/errors'
import { createGitHubIssue } from '../utils/github'
import { createRateLimiter } from '../utils/rate-limiter'
import { clientAddress, readJsonRecord, requireSameOrigin } from '../utils/request'
import { requireMode, upstreamClient } from '../utils/runtime'
import { buildSuggestionIssue, isHoneypotFilled, parseSuggestion } from '../utils/suggestion'

/** A real suggestion is well under a kilobyte. */
const BODY_MAXIMUM_LENGTH = 16_384

// Three suggestions per address every ten minutes. This is a courtesy limit held in memory: on Cloudflare Workers
// each isolate keeps its own count and loses it when it restarts (see rate-limiter.ts). A firm limit belongs in a
// Cloudflare rate limiting rule on this route.
const suggestionLimiter = createRateLimiter({
  limit: 3,
  windowMilliseconds: 10 * 60 * 1000,
  maximumKeys: 5000,
})

/** POST /api/suggestions: files a player's suggestion for a missing training method as a GitHub issue. */
export default defineEventHandler(async (event) => {
  requireMode(event, 'hosted')
  requireSameOrigin(event)
  const config = useRuntimeConfig(event)
  const target = { repository: config.public.githubRepo, token: config.githubToken }
  if (!target.repository || !target.token) {
    throw apiError(503, 'Suggestions are not switched on yet.')
  }

  const body = await readJsonRecord(event, BODY_MAXIMUM_LENGTH)
  if (isHoneypotFilled(body)) return { ok: true }
  const suggestion = valueOrThrow(parseSuggestion(body))
  // checked last, so a suggestion that failed a check does not use up one of the three
  if (!suggestionLimiter.allow(clientAddress(event))) {
    throw apiError(429, 'That is a few in a row. Try again in ten minutes.')
  }

  const outcome = await createGitHubIssue(
    buildSuggestionIssue(suggestion),
    target,
    upstreamClient(event),
  )
  if (!outcome.created) {
    console.error(`Suggestion not filed: ${outcome.reason}.`)
    throw apiError(502, 'Could not send it. Try again in a minute.')
  }
  return { ok: true }
})

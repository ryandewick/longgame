import { describe, expect, it } from 'vitest'
import { apiErrorMessage, lookupErrorMessage } from '~~/app/utils/api-error'

/** An error shaped like the one `$fetch` throws for a refusal from one of this app's routes. */
const refusal = (message: string) => ({
  request: '/api/hiscores',
  status: 404,
  data: { statusCode: 404, message, data: { message } },
})

describe('apiErrorMessage', () => {
  it('reads the sentence the route sent for the player', () => {
    expect(apiErrorMessage(refusal('No hiscores entry for that name.'))).toBe(
      'No hiscores entry for that name.',
    )
  })

  it.each([
    ['an error with no body', new Error('fetch failed')],
    ['a body with no data', { data: { message: 'Not Found' } }],
    ['an empty sentence', refusal('')],
    ['nothing at all', undefined],
  ])('is null for %s', (_what, error) => {
    expect(apiErrorMessage(error)).toBeNull()
  })
})

describe('lookupErrorMessage', () => {
  it("passes on the server's own sentence", () => {
    expect(lookupErrorMessage(refusal('Hiscores returned 503.'))).toBe('Hiscores returned 503.')
  })

  it('says the lookup could not be reached when the request got no answer', () => {
    const offline = { request: '/api/hiscores', status: undefined, data: undefined }
    expect(lookupErrorMessage(offline)).toBe(
      'Could not reach the lookup. Check your connection and try again.',
    )
  })

  it('falls back to a plain sentence for anything else', () => {
    expect(lookupErrorMessage({ request: '/api/hiscores', status: 500, data: 'oops' })).toBe(
      'Could not fetch.',
    )
    expect(lookupErrorMessage(new TypeError('x is not a function'))).toBe('Could not fetch.')
  })
})

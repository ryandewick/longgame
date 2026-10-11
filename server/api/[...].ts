import { apiError } from '../utils/errors'

/**
 * Any other /api address, or a real one asked with the wrong method. Without this the request would fall through to
 * the page renderer and come back as a web page, which no caller of an API can use.
 *
 * The file name has to stay the unnamed `[...]`: the router only falls back to a catch-all for a wrong method when
 * the catch-all has no parameter name.
 */
export default defineEventHandler(() => {
  throw apiError(404, 'Not found.')
})

/*
 * The response headers the website sends, in one place.
 *
 * They reach a browser by two roads. What the server answers itself (the API, a page drawn on request) gets them
 * from `routeRules` in nuxt.config.ts. On Cloudflare most of the site never reaches the server: the pages written
 * out by the build, /assets and the build's own files are served straight from disk, and Cloudflare reads their
 * headers from a file named `_headers` beside them. That file is built here and written by
 * modules/cloudflare-headers.ts.
 */

/** Sent with every response. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  // a file is what its Content-Type says it is, never what a browser guesses from its contents
  'x-content-type-options': 'nosniff',
  // another site is told which site a visitor came from, never which page
  'referrer-policy': 'strict-origin-when-cross-origin',
  // no other site may show these pages inside a frame; the first header is for browsers older than the second
  'x-frame-options': 'DENY',
  'content-security-policy': "frame-ancestors 'none'",
}

/** Kept by the browser for a year without asking again. Only for a file whose address changes when it does. */
export const CACHE_FOR_A_YEAR = 'public, max-age=31536000, immutable'

/** Kept by the browser, but checked with the server before every use. */
export const CACHE_BUT_CHECK_FIRST = 'public, max-age=0, must-revalidate'

/** Never kept: API answers are about one player at one moment. */
export const NEVER_CACHE = 'no-store'

/** One block of a `_headers` file: the headers for every file whose address matches `path`. */
export interface StaticHeaderRule {
  /** An address, where `*` stands for anything after it: '/assets/*'. */
  readonly path: string
  readonly headers: Readonly<Record<string, string>>
}

/**
 * The headers for the files Cloudflare serves from disk.
 *
 * Every rule that matches a file is applied, from the top of the list down, so the list runs from the general to
 * the particular. `buildAssetsPath` is where the build puts its own files: '/_nuxt/'.
 */
export function staticFileHeaderRules(buildAssetsPath: string): StaticHeaderRule[] {
  const buildFiles = `/${buildAssetsPath.replaceAll('/', '')}`
  return [
    { path: '/*', headers: SECURITY_HEADERS },
    // Game art and fonts. Their names carry no hash, so a file that changes has to be given a new name.
    { path: '/assets/*', headers: { 'cache-control': CACHE_FOR_A_YEAR } },
    // The build's scripts and styles, each named after a hash of its contents.
    { path: `${buildFiles}/*`, headers: { 'cache-control': CACHE_FOR_A_YEAR } },
    // builds/latest.json keeps its name from one build to the next: an open page reads it to learn that a newer
    // build is out, so it must never be served from a browser's cache without a check.
    { path: `${buildFiles}/builds/*`, headers: { 'cache-control': CACHE_BUT_CHECK_FIRST } },
    // builds/meta/<build id>.json is named after its build and never changes.
    { path: `${buildFiles}/builds/meta/*`, headers: { 'cache-control': CACHE_FOR_A_YEAR } },
  ]
}

/**
 * Writes rules out as a `_headers` file.
 *
 * Cloudflare joins the values when two matching rules set the same header ("max-age=31536000, max-age=0"), which
 * no browser reads the way either rule meant. So a rule first takes away each header it sets (the `! name` line),
 * and the last matching rule's value is the only one sent.
 */
export function buildHeadersFile(rules: readonly StaticHeaderRule[]): string {
  return rules
    .map(({ path, headers }) => {
      const names = Object.keys(headers)
      return [
        path,
        ...names.map((name) => `  ! ${name}`),
        ...names.map((name) => `  ${name}: ${headers[name]}`),
      ].join('\n')
    })
    .join('\n')
    .concat('\n')
}

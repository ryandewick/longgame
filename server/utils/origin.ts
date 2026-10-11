/**
 * Whether a request came from our own pages.
 *
 * Browsers send an `Origin` header on every cross-site write, so a header that names another site means some other
 * page is trying to use this API with the player's browser. A request with no `Origin` header is not from a page on
 * another site (it is a same-origin GET or a tool such as curl) and is let through.
 */
export function isSameOrigin(originHeader: string | undefined, requestUrl: URL): boolean {
  return !originHeader || originHeader === requestUrl.origin
}

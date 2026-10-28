/*
 * What longgame.tools serves while the planner is offline.
 *
 * Jagex's Fan Content Policy does not permit software or applications that use Jagex property
 * (their IP team confirmed it for this project on 27 October 2026), so the planner runs only as a
 * local copy for now. This Worker takes the planner's place on the domain: one holding page, made
 * of nothing but the Long Game mark, for every address.
 *
 * The home page answers 200 and every other address 410 Gone, so search engines drop the old
 * guides and tools rather than wait for them to come back. Every answer says noindex.
 *
 * Deploy with: npm run deploy:placeholder
 */

const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#ffff00"/><g transform="translate(6.4 6.4) scale(.8)" fill="none" stroke-width="9.5"><circle cx="32" cy="26" r="14" stroke="#7d7a0a"/><path d="M46 26V37c0 9.5-6 15-15 15h-5" stroke="#7d7a0a"/><path d="M32 12A14 14 0 1 1 18.00 26.00" stroke="#16120f"/></g></svg>'

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="description" content="Long Game is offline.">
<title>Long Game</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; }
  body {
    display: grid;
    place-items: center;
    padding: 24px;
    box-sizing: border-box;
    background: #191411;
    color: #f0e2c4;
    font: 17px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    text-align: center;
  }
  main { max-width: 34ch; }
  svg { width: 72px; height: 72px; display: block; margin: 0 auto 28px; }
  h1 { margin: 0 0 10px; font-size: 26px; font-weight: 750; letter-spacing: -0.01em; color: #fff; }
  p { margin: 0; color: #b9ab92; }
</style>
</head>
<body>
<main>
${MARK}
<h1>Long Game is offline</h1>
<p>Thanks to everyone who tried it.</p>
</main>
</body>
</html>
`

const NOINDEX = { 'x-robots-tag': 'noindex', 'cache-control': 'public, max-age=300' }

export default {
  fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/robots.txt') {
      // crawling stays allowed, so search engines can read the noindex and the 410s
      return new Response('User-agent: *\nAllow: /\n', {
        headers: { 'content-type': 'text/plain; charset=utf-8', ...NOINDEX },
      })
    }
    if (pathname === '/favicon.svg' || pathname === '/favicon.ico') {
      return new Response(MARK, { headers: { 'content-type': 'image/svg+xml', ...NOINDEX } })
    }
    return new Response(PAGE, {
      status: pathname === '/' ? 200 : 410,
      headers: { 'content-type': 'text/html; charset=utf-8', ...NOINDEX },
    })
  },
}

/*
 * What longgame.tools serves while the planner is offline.
 *
 * Jagex's Fan Content Policy does not permit software or applications that use Jagex property
 * (their IP team confirmed it for this project on 27 October 2026), so the planner runs only as a
 * local copy for now. This Worker takes the planner's place on the domain: one holding page, made
 * of nothing but the Long Game icon (the 99, as in public/favicon.svg), for every address.
 *
 * The home page answers 200 and every other address 410 Gone, so search engines drop the old
 * guides and tools rather than wait for them to come back. Every answer says noindex.
 *
 * Deploy with: npm run deploy:placeholder
 */

const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#191411" stroke="#3b3129" stroke-width="2"/><g transform="translate(8 50.9899) scale(0.0505 -0.0505)"><path d="M316 153Q361 153 377.5 195.5Q394 238 394 332Q374 303 338.0 286.0Q302 269 257 269Q161 269 101.0 329.0Q41 389 41 502Q41 576 72.0 631.5Q103 687 160.5 717.0Q218 747 295 747Q448 747 508.5 654.5Q569 562 569 386Q569 189 510.5 92.0Q452 -5 310 -5Q233 -5 177.5 26.5Q122 58 92.5 109.5Q63 161 59 221H242Q254 153 316 153ZM379 497Q379 537 358.5 557.0Q338 577 302 577Q266 577 245.5 556.5Q225 536 225 498Q225 463 245.5 442.0Q266 421 304 421Q339 421 359.0 441.5Q379 462 379 497Z" transform="translate(-41 5)" fill="#ffff00"/><path d="M316 153Q361 153 377.5 195.5Q394 238 394 332Q374 303 338.0 286.0Q302 269 257 269Q161 269 101.0 329.0Q41 389 41 502Q41 576 72.0 631.5Q103 687 160.5 717.0Q218 747 295 747Q448 747 508.5 654.5Q569 562 569 386Q569 189 510.5 92.0Q452 -5 310 -5Q233 -5 177.5 26.5Q122 58 92.5 109.5Q63 161 59 221H242Q254 153 316 153ZM379 497Q379 537 358.5 557.0Q338 577 302 577Q266 577 245.5 556.5Q225 536 225 498Q225 463 245.5 442.0Q266 421 304 421Q339 421 359.0 441.5Q379 462 379 497Z" transform="translate(381.4 5)" fill="#191411" stroke="#191411" stroke-width="44" stroke-linejoin="round"/><path d="M316 153Q361 153 377.5 195.5Q394 238 394 332Q374 303 338.0 286.0Q302 269 257 269Q161 269 101.0 329.0Q41 389 41 502Q41 576 72.0 631.5Q103 687 160.5 717.0Q218 747 295 747Q448 747 508.5 654.5Q569 562 569 386Q569 189 510.5 92.0Q452 -5 310 -5Q233 -5 177.5 26.5Q122 58 92.5 109.5Q63 161 59 221H242Q254 153 316 153ZM379 497Q379 537 358.5 557.0Q338 577 302 577Q266 577 245.5 556.5Q225 536 225 498Q225 463 245.5 442.0Q266 421 304 421Q339 421 359.0 441.5Q379 462 379 497Z" transform="translate(381.4 5)" fill="#ffff00"/></g></svg>'

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

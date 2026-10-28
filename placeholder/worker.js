/*
 * What longgame.tools serves while the planner is offline.
 *
 * Jagex's Fan Content Policy does not permit software or applications that use Jagex property
 * (their IP team confirmed it for this project on 27 October 2026), so the planner runs only as a
 * local copy for now. This Worker takes the planner's place on the domain: one holding page
 * (index.html), made of nothing but the Long Game brand, for every address.
 *
 * The page asks for three files of its own: the wordmark and Figtree fonts (the app's own, from
 * public/assets/fonts) and the icon (the 99, as in public/favicon.svg). The home page answers 200
 * and every other address 410 Gone, so search engines drop the old guides and tools rather than
 * wait for them to come back. Every answer says noindex.
 *
 * Deploy with: npm run deploy:placeholder
 */

import PAGE from './index.html'
import WORDMARK_FONT from '../public/assets/fonts/poppins-800-wordmark.woff2'
import FIGTREE_FONT from '../public/assets/fonts/figtree-latin.woff2'

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#191411" stroke="#3b3129" stroke-width="2"/><g transform="translate(8 50.9899) scale(0.0505 -0.0505)"><path d="M316 153Q361 153 377.5 195.5Q394 238 394 332Q374 303 338.0 286.0Q302 269 257 269Q161 269 101.0 329.0Q41 389 41 502Q41 576 72.0 631.5Q103 687 160.5 717.0Q218 747 295 747Q448 747 508.5 654.5Q569 562 569 386Q569 189 510.5 92.0Q452 -5 310 -5Q233 -5 177.5 26.5Q122 58 92.5 109.5Q63 161 59 221H242Q254 153 316 153ZM379 497Q379 537 358.5 557.0Q338 577 302 577Q266 577 245.5 556.5Q225 536 225 498Q225 463 245.5 442.0Q266 421 304 421Q339 421 359.0 441.5Q379 462 379 497Z" transform="translate(-41 5)" fill="#ffff00"/><path d="M316 153Q361 153 377.5 195.5Q394 238 394 332Q374 303 338.0 286.0Q302 269 257 269Q161 269 101.0 329.0Q41 389 41 502Q41 576 72.0 631.5Q103 687 160.5 717.0Q218 747 295 747Q448 747 508.5 654.5Q569 562 569 386Q569 189 510.5 92.0Q452 -5 310 -5Q233 -5 177.5 26.5Q122 58 92.5 109.5Q63 161 59 221H242Q254 153 316 153ZM379 497Q379 537 358.5 557.0Q338 577 302 577Q266 577 245.5 556.5Q225 536 225 498Q225 463 245.5 442.0Q266 421 304 421Q339 421 359.0 441.5Q379 462 379 497Z" transform="translate(381.4 5)" fill="#191411" stroke="#191411" stroke-width="44" stroke-linejoin="round"/><path d="M316 153Q361 153 377.5 195.5Q394 238 394 332Q374 303 338.0 286.0Q302 269 257 269Q161 269 101.0 329.0Q41 389 41 502Q41 576 72.0 631.5Q103 687 160.5 717.0Q218 747 295 747Q448 747 508.5 654.5Q569 562 569 386Q569 189 510.5 92.0Q452 -5 310 -5Q233 -5 177.5 26.5Q122 58 92.5 109.5Q63 161 59 221H242Q254 153 316 153ZM379 497Q379 537 358.5 557.0Q338 577 302 577Q266 577 245.5 556.5Q225 536 225 498Q225 463 245.5 442.0Q266 421 304 421Q339 421 359.0 441.5Q379 462 379 497Z" transform="translate(381.4 5)" fill="#ffff00"/></g></svg>'

const NOINDEX = { 'x-robots-tag': 'noindex' }
const SHORT = { ...NOINDEX, 'cache-control': 'public, max-age=300' }
const LONG = { ...NOINDEX, 'cache-control': 'public, max-age=86400' }

/** The files the page asks for by address, as [body, content type, headers]. */
const FILES = {
  '/favicon.svg': [ICON, 'image/svg+xml', SHORT],
  '/favicon.ico': [ICON, 'image/svg+xml', SHORT],
  '/fonts/wordmark.woff2': [WORDMARK_FONT, 'font/woff2', LONG],
  '/fonts/figtree.woff2': [FIGTREE_FONT, 'font/woff2', LONG],
  // crawling stays allowed, so search engines can read the noindex and the 410s
  '/robots.txt': ['User-agent: *\nAllow: /\n', 'text/plain; charset=utf-8', SHORT],
}

export default {
  fetch(request) {
    const { pathname } = new URL(request.url)
    const file = FILES[pathname]
    if (file) {
      const [body, type, headers] = file
      return new Response(body, { headers: { 'content-type': type, ...headers } })
    }
    return new Response(PAGE, {
      status: pathname === '/' ? 200 : 410,
      headers: { 'content-type': 'text/html; charset=utf-8', ...SHORT },
    })
  },
}

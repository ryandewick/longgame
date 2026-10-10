/* Long Game relay: a Cloudflare Worker that sits in front of the static site.
   It does three things a web page cannot do on its own:
     GET  /api/hiscores?name=   looks a player up on Jagex's public hiscores (they send no cross-origin header)
     GET  /api/acctype?name=    tells a main from an ironman by which hiscores table the name is on
     POST /api/suggest          files a player's method suggestion as a GitHub issue for review
   Everything else is served from the static files in ./site. Nothing about a player is stored here. */

const HISCORES = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=';
const HISCORES_IRON = 'https://secure.runescape.com/m=hiscore_oldschool_ironman/index_lite.json?player=';
const SKILLS = ['attack', 'defence', 'strength', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting',
  'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft', 'hunter', 'construction', 'sailing'];
const NAME = /^[A-Za-z0-9 _-]{1,12}$/;

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});
const agent = env => 'LongGame/1.0 (free fan tool' + (env.SITE_URL ? '; ' + env.SITE_URL : '') + ')';

async function lookup(url, env) {
  return fetch(url, { headers: { 'User-Agent': agent(env), Accept: 'application/json' } });
}

async function hiscores(name, env, ctx, request) {
  // one answer a minute per name is plenty, and it keeps us gentle on Jagex's servers
  const cache = typeof caches !== 'undefined' && caches.default;
  const key = new Request(new URL('/api/hiscores?name=' + encodeURIComponent(name.toLowerCase()), request.url).toString());
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  let r;
  try { r = await lookup(HISCORES + encodeURIComponent(name), env); } catch (e) { return json({ error: 'Could not reach the hiscores. Try again in a minute.' }, 502); }
  if (r.status === 404) return json({ error: 'No hiscores entry for that name. Check the spelling, and note that brand-new accounts need a few levels first.' }, 502);
  if (!r.ok) return json({ error: 'Hiscores returned ' + r.status + '.' }, 502);
  let data;
  try { data = await r.json(); } catch (e) { return json({ error: 'The hiscores sent something unreadable. Try again in a minute.' }, 502); }
  data.fetched = Date.now();
  const res = json(data, 200, { 'Cache-Control': 'public, max-age=60' });
  if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function acctype(name, env) {
  // an account is only on the ironman hiscores if it is an ironman
  let r;
  try { r = await lookup(HISCORES_IRON + encodeURIComponent(name), env); } catch (e) { return json({ error: 'Could not reach the hiscores.' }, 502); }
  if (r.status === 404) return json({ type: 'main' });
  if (!r.ok) return json({ error: 'Hiscores returned ' + r.status + '.' }, 502);
  return json({ type: 'ironman' });
}

/* suggestions: three per address every ten minutes. This is a courtesy limit held in memory, so it resets when the
   Worker restarts. Add a rate limiting rule on /api/suggest in the Cloudflare dashboard for a firm one. */
const recent = new Map();
function tooMany(ip) {
  const now = Date.now(), list = (recent.get(ip) || []).filter(t => now - t < 600000);
  if (list.length >= 3) { recent.set(ip, list); return true; }
  list.push(now); recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return false;
}
// what a player typed, made safe to sit in a GitHub issue: no mentions, no markup, no control characters
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>`]/g, "'").replace(/@/g, '@​').replace(/\s+/g, ' ').trim().slice(0, max);

async function suggest(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Not allowed.' }, 403);
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ error: 'Suggestions are not switched on yet.' }, 503);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Could not read that.' }, 400); }
  if (!b || typeof b !== 'object') return json({ error: 'Could not read that.' }, 400);
  if (b.website) return json({ ok: true }); // the hidden field only a bot fills in
  const skill = String(b.skill || ''), level = Number(b.level), xph = b.xph === '' || b.xph == null ? 0 : Number(b.xph);
  const name = clean(b.name, 80), notes = clean(b.notes, 600), wiki = String(b.wiki || '').trim();
  const int = { afk: 'AFK', semi: 'Semi-AFK', active: 'Active' }[b.intensity], who = { both: 'Mains and ironmen', main: 'Mains only', iron: 'Ironmen only' }[b.who];
  if (!SKILLS.includes(skill)) return json({ error: 'Pick a skill.' }, 400);
  if (!Number.isInteger(level) || level < 1 || level > 99) return json({ error: 'The level has to be between 1 and 99.' }, 400);
  if (name.length < 3) return json({ error: 'Give the method a name.' }, 400);
  if (!Number.isFinite(xph) || xph < 0 || xph > 2000000) return json({ error: 'That XP an hour does not look right.' }, 400);
  if (!int || !who) return json({ error: 'Something in the form is missing.' }, 400);
  if (!/^https:\/\/oldschool\.runescape\.wiki\/[^\s<>"'`]{1,180}$/.test(wiki)) return json({ error: 'Add a link to the method on the Old School RuneScape Wiki.' }, 400);
  if (tooMany(request.headers.get('CF-Connecting-IP') || 'unknown')) return json({ error: 'That is a few in a row. Try again in ten minutes.' }, 429);
  const title = '[Method] ' + skill[0].toUpperCase() + skill.slice(1) + ' ' + level + ': ' + name;
  const body = ['**Skill:** ' + skill, '**Level:** ' + level, '**Method:** ' + name, '**XP an hour:** ' + (xph ? Math.round(xph).toLocaleString('en-GB') : 'not given'),
    '**Attention:** ' + int, '**Works for:** ' + who, '**Wiki:** ' + wiki, '', '**Notes:** ' + (notes || 'none'), '', '_Sent from the suggestion form. Check it against the wiki before adding it to datasrc._'].join('\n');
  let r;
  try {
    r = await fetch('https://api.github.com/repos/' + env.GITHUB_REPO + '/issues', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': agent(env), 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ title, body, labels: ['method suggestion'] }),
    });
  } catch (e) { return json({ error: 'Could not send it. Try again in a minute.' }, 502); }
  if (!r.ok) return json({ error: 'Could not send it. Try again in a minute.' }, 502);
  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/suggest') return request.method === 'POST' ? suggest(request, env) : json({ error: 'not found' }, 404);
    if (request.method !== 'GET') return json({ error: 'not found' }, 404);
    const name = (url.searchParams.get('name') || '').trim();
    if (['/api/hiscores', '/api/acctype'].includes(url.pathname)) {
      if (!name) return json({ error: 'no name' }, 400);
      if (!NAME.test(name)) return json({ error: 'That does not look like a RuneScape name.' }, 400);
      if (url.pathname === '/api/hiscores') return hiscores(name, env, ctx, request);
      return acctype(name, env);
    }
    return json({ error: 'not found' }, 404);
  },
};

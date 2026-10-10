/* Constants, the three ways the app can run, and small helpers used everywhere. */

const MAXXP = 13034431,
  STORAGE_KEY = 'longgame.state.v1';

/* Three ways to run. SERVER: the local Python server, with state and snapshots on disk. HOSTED: the public site, where a relay
   answers the hiscores lookups and everything else lives in this browser. Neither: the page opened as a file. */
const CONFIG = window.LG || {};
const HOSTED = !!CONFIG.hosted;
const SERVER = !HOSTED && location.protocol.startsWith('http');
const API = HOSTED ? (CONFIG.api || '').replace(/\/$/, '') : '';
const ONLINE = SERVER || HOSTED;

/* Quest and diary syncing is not part of the published code: the OSRS Wiki does not permit third-party use of WikiSync.
   A private local copy can supply window.LGSync (local_sync.js, kept out of the repository). Without it, quests are ticked by hand. */
const SYNC = !HOSTED && typeof window.LGSync === 'function';
const SKILL = Object.fromEntries(SKILLS.map((s) => [s.k, s]));
const XP = [0, 0];
for (let l = 2; l <= 126; l++) {
  let t = 0;
  for (let i = 1; i < l; i++) t += Math.floor(i + 300 * Math.pow(2, i / 7));
  XP[l] = Math.floor(t / 4);
}
const lvlFor = (xp) => {
  let l = 1;
  while (l < 99 && XP[l + 1] <= xp) l++;
  return l;
};
const INTENSITY = { afk: 'AFK', semi: 'Semi-AFK', active: 'Active', reset: 'Reset', wild: 'Wildcard' };
const COST = { profit: 'pays', free: 'free', cheap: 'cheap', pricey: 'pricey' };
const WILDCARDS = [
  { n: 'Boss trip', d: 'Twenty minutes at whatever your gear and stats allow. Giant Mole if in doubt.' },
  { n: 'Clue scroll', d: 'Do one from the bank, or go and get one. Any tier.' },
  { n: 'Slayer task', d: 'One task, start to finish.' },
  { n: 'Lowest skill, fifteen minutes', d: 'Whatever sits at the bottom of the list. No method required.' },
  { n: 'Tempoross', d: 'One game. Fishing XP and a Fish barrel to pray for.', req: 's:fishing 35' },
  { n: 'Wintertodt', d: 'One game. Firemaking XP and a crate.', req: 's:firemaking 50' },
  {
    n: 'Guardians of the Rift',
    d: 'Two games. Pouches and the Raiments of the Eye.',
    req: 'q:Temple of the Eye;s:runecraft 27',
  },
  { n: 'Barbarian Assault', d: 'A few waves toward the torso.' },
  { n: 'Pest Control', d: 'Ten minutes of Void points.' },
  {
    n: 'Mahogany Homes',
    d: 'Three contracts. Cheap Construction and the Carpenter’s outfit.',
    req: 's:construction 20',
  },
];

/* utils */
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const fmtK = (n) =>
  n >= 1e6
    ? (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
    : n >= 1e3
      ? Math.round(n / 1e3) + 'k'
      : String(Math.round(n));
const hrs = (h) =>
  h < 1 ? Math.round(h * 60) + ' min' : h < 10 ? h.toFixed(1).replace(/\.0$/, '') + ' h' : fmt(h) + ' h';
const clock = (ms) => {
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60000),
    s = Math.floor((ms % 60000) / 1000);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};
const dayKey = (t) => {
  const d = new Date(t);
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};
const ago = (t) => {
  const m = (Date.now() - t) / 60000;
  return m < 1
    ? 'just now'
    : m < 60
      ? Math.round(m) + ' min ago'
      : m < 1440
        ? Math.round(m / 60) + ' h ago'
        : Math.round(m / 1440) + ' d ago';
};

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wpick(items, w) {
  let t = w.reduce((a, b) => a + b, 0);
  if (t <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * t;
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

async function api(path, opts) {
  let r;
  try {
    r = await fetch(path, opts);
  } catch (e) {
    throw new Error('Could not reach the lookup. Check your connection and try again.');
  }
  const j = await r.json().catch(() => ({ error: 'bad response' }));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}

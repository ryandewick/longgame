/* The brand: skillcape colours and images, skill icons, and the ring-and-tail mark that fills with progress to max. */

/* Each skillcape's colour and its trim, sampled from the game's own cape art. A skill wears its cape wherever it appears. */
const ASSETS = 'assets/osrs/';
const CAPE = {
  attack: ['#6e1e16', '#cdb418'],
  defence: ['#687bb7', '#9f9b7e'],
  strength: ['#0b6944', '#931e10'],
  hitpoints: ['#a5a4a1', '#9e2114'],
  ranged: ['#546a1f', '#8b5833'],
  prayer: ['#cdc5c5', '#ceb41e'],
  magic: ['#988c78', '#3f4191'],
  cooking: ['#52245e', '#78190d'],
  woodcutting: ['#887143', '#2e6741'],
  fletching: ['#194c4e', '#b17915'],
  fishing: ['#839fb8', '#b17915'],
  firemaking: ['#bb6b1a', '#d0b719'],
  crafting: ['#775d46', '#cfb519'],
  smithing: ['#565546', '#b17915'],
  mining: ['#595847', '#649ab0'],
  herblore: ['#0a600d', '#c6ae18'],
  agility: ['#34356e', '#84322b'],
  thieving: ['#6e445f', '#3d3838'],
  slayer: ['#2a2526', '#8e1c10'],
  farming: ['#2d582e', '#8fa65e'],
  runecraft: ['#a3a398', '#cdb418'],
  hunter: ['#696347', '#3a352c'],
  construction: ['#948a77', '#a57524'],
  sailing: ['#2c597b', '#715240'],
};
const cape = (k) => CAPE[k] || ['#2c241d', '#b08a45'];
const capeImg = (k, trimmed) =>
  ASSETS + 'capes-md/' + (CAPE[k] ? k + (trimmed ? '_t' : '') : 'max') + '.webp';

/* a skill's icon. '?' is the wildcard's; anything else without a skill gets an empty slot so rows stay aligned */
const icon = (k, cls, title) =>
  '<span class="ic' +
  (cls ? ' ' + cls : '') +
  (k === '?' ? ' wild' : '') +
  '"' +
  (title ? ' title="' + esc(title) + '"' : '') +
  '>' +
  (CAPE[k] ? '<img src="' + ASSETS + 'icons/' + k + '.png" alt="">' : k === '?' ? '?' : '') +
  '</span>';
const blockIcon = (b, title) => icon(blockSkill(b) || (b.kind === 'wild' ? '?' : null), '', title);

/* a cape colour that still shows on the dark ground: the cape's own hue, lightened until it reads. Only a dark cape with
   almost no colour in it (Slayer's black) falls back to its trim. */
const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (x, y) => {
  const a = lum(x),
    b = lum(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const mixColours = (a, b, t) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const bright = (k) => {
  const [a, b] = cape(k);
  const ch = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  let c = Math.max(...ch) - Math.min(...ch) < 24 && lum(a) < 0.05 ? b : a;
  for (let i = 0; i < 14 && ratio(c, '#191411') < 3; i++) c = mixColours(c, '#ffffff', 0.1);
  return c;
};

/* the skill a block trains: its own, or the one a reset feeds. A wildcard has none. */
const blockSkill = (b) =>
  b.kind === 'skill' ? b.k : b.kind === 'wild' ? null : (RESETS.find((r) => r.k === b.k) || {}).skill || null;

/* The mark: one ring and a tail, a 9 and a g at once. The ring fills with the account's progress to max,
   so every player's icon is their own. Outside the app it sits at three quarters. */

function markInner(pct) {
  const p = Math.max(0, Math.min(0.9999, pct)),
    a = p * 2 * Math.PI,
    x = (32 + 14 * Math.sin(a)).toFixed(2),
    y = (26 - 14 * Math.cos(a)).toFixed(2),
    full = pct >= 1;
  return (
    '<g fill="none" stroke-width="9.5"><circle cx="32" cy="26" r="14" stroke="#7d7a0a"/><path d="M46 26V37c0 9.5-6 15-15 15h-5" stroke="' +
    (full ? '#16120f' : '#7d7a0a') +
    '"/>' +
    (p > 0.004
      ? '<path d="M32 12A14 14 0 ' + (p > 0.5 ? 1 : 0) + ' 1 ' + x + ' ' + y + '" stroke="#16120f"/>'
      : '') +
    '</g>'
  );
}
const brandHTML = (pct) =>
  '<span class="tile"><svg viewBox="0 0 64 64" aria-hidden="true">' +
  markInner(pct) +
  '</svg></span><span class="wm" aria-hidden="true">lon<span>9</span> <span>9</span>ame</span>';

function setFavicon(pct) {
  const l = $('#fav');
  if (l)
    l.href =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#ffff00"/><g transform="translate(6.4 6.4) scale(.8)">' +
          markInner(pct) +
          '</g></svg>',
      );
}

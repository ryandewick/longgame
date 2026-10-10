/* The rack: every skillcape on one rail, lowest level first, each filled as far as its level. */

/* Every skillcape on one rail, lowest level first. Each is drawn twice: once greyed out, once in colour and clipped
   from the bottom to its level, so a cape fills as the skill climbs. The max cape hangs at the end, filled to the account's total. */
const capePair = (src) =>
  '<img class="dim" src="' + src + '" alt=""><img class="lit" src="' + src + '" alt="">';

function capeHTML(k, nowK) {
  const s = stat(k),
    maxed = s.level >= 99;
  const tip =
    SKILL[k].n +
    ' ' +
    s.level +
    (maxed ? '' : ', ' + fmtK(XP[s.level + 1] - s.xp) + ' xp to ' + (s.level + 1));
  return (
    '<button class="c' +
    (maxed ? ' max' : '') +
    (k === nowK ? ' now' : '') +
    '" data-act="cape" data-k="' +
    k +
    '" title="' +
    esc(tip) +
    '" aria-label="' +
    esc(tip) +
    '"><span class="im" style="--p:' +
    pos(s.level) +
    '%">' +
    capePair(capeImg(k, maxed)) +
    '</span><b class="rs">' +
    s.level +
    '</b></button>'
  );
}

function lvlupHTML() {
  // the last session's level-up, said the way the game says it
  const s = state.session;
  if (!s || !s.ended || !s.levels) return '';
  const ks = Object.keys(s.levels).filter((k) => SKILL[k]);
  if (!ks.length) return '';
  const k = ks[0],
    n = SKILL[k].n;
  return (
    '<div class="lvlup">' +
    icon(k) +
    '<span>Congratulations, you just advanced a' +
    (/^[AEIOU]/.test(n) ? 'n ' : ' ') +
    esc(n) +
    ' level.<br>Your ' +
    esc(n) +
    ' level is now ' +
    stat(k).level +
    '.' +
    (ks.length > 1 ? ' And ' + (ks.length - 1) + ' more.' : '') +
    '</span></div>'
  );
}

function rackHTML(nowK) {
  const ks = skillList()
    .slice()
    .sort((a, b) => stat(a).level - stat(b).level || stat(a).xp - stat(b).xp);
  const m = maxStats();
  const done = m.maxed === m.n;
  return (
    '<section class="stage" aria-label="Your skillcapes"><div class="wrap"><div class="stage-top"><h1><span class="rs x3">' +
    m.maxed +
    '/' +
    m.n +
    '</span> capes</h1>' +
    '<p>' +
    (done
      ? 'Maxed. Every cape is on the rail.'
      : fmt(m.levels) +
        ' levels to go, about ' +
        long(m.hours) +
        ' at your best methods' +
        (skillList().some(rough) ? ' (rough where the wiki gives no rate)' : '') +
        '.') +
    '</p>' +
    lvlupHTML() +
    '<button class="btn sm share-b" data-act="share">Share my rack</button></div>' +
    '<div class="capes" style="--n:' +
    ks.length +
    '">' +
    ks.map((k) => capeHTML(k, nowK)).join('') +
    '<i class="sp"></i><i class="sp"></i>' +
    '<button class="goal' +
    (done ? ' max' : '') +
    '" data-act="view" data-v="skills" title="' +
    m.pct.toFixed(2) +
    '% of the XP to max"><span class="im" style="--p:' +
    m.pct.toFixed(1) +
    '%">' +
    capePair(ASSETS + 'capes-md/max.webp') +
    '</span><b class="rs w">Max cape</b></button></div></div></section>'
  );
}

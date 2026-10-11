/* Tonight: the deal panel, the live block, the session slots and the side lists. */

function maxSideHTML() {
  const m = maxStats();
  const p = pace(null, 7);
  const eta = p.perDay > 0 ? skillList().reduce((a, k) => a + remain(k), 0) / p.perDay : null;
  const rows = [
    ['XP banked', fmtK(m.xp) + ' of ' + fmtK(m.n * MAXXP)],
    ['At your 7-day pace', eta ? fmt(Math.round(eta)) + ' days' : 'no pace yet'],
    ['Day streak', streak()],
  ];
  return (
    '<section><div class="sec"><h3>To max</h3><span class="rs">' +
    m.pct.toFixed(2) +
    '%</span></div><dl class="kv">' +
    rows.map((r) => '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('') +
    '</dl></section>'
  );
}

function resetsSideHTML() {
  const rs = RESETS.filter((r) => resetMine(r) && !reqState(r.req).length)
    .map((r) => ({ r, d: resetDue(r) }))
    .sort((a, b) => b.d.due - a.d.due);
  const due = rs.filter((x) => x.d.due).length;
  if (!rs.length)
    return '<section><div class="sec"><h3>Resets</h3></div><p class="quiet">Nothing unlocked yet. The Resets view lists what each one needs.</p></section>';
  return (
    '<section><div class="sec"><h3>Resets</h3><span class="sub">' +
    (due ? due + ' due' : 'none due') +
    '</span></div><ul class="rsl">' +
    rs
      .slice(0, 5)
      .map(
        (x) =>
          '<li>' +
          icon(x.r.skill) +
          '<b>' +
          esc(x.r.n) +
          '</b>' +
          (x.d.due
            ? '<span class="rs g">Due</span><button class="btn sm ghost" data-act="rd" data-k="' +
              x.r.k +
              '">Done</button>'
            : '<span class="in-t">' + esc(x.d.text.replace('ready in', 'in')) + '</span>') +
          '</li>',
      )
      .join('') +
    '</ul>' +
    (rs.length > 5
      ? '<p class="quiet"><a href="#" data-act="view" data-v="resets">All ' + rs.length + ' resets</a></p>'
      : '') +
    '</section>'
  );
}

function nextCapesHTML() {
  const ks = skillList()
    .filter((k) => stat(k).level < 99 && !isPassive(k))
    .sort((a, b) => hoursLeft(a) - hoursLeft(b))
    .slice(0, 3);
  if (!ks.length) return '';
  return (
    '<section><div class="sec"><h3>Next capes</h3><span class="sub">closest first</span></div><ul class="rsl nx">' +
    ks
      .map((k) => {
        const dl = daysLeft(k),
          h = hoursLeft(k);
        return (
          '<li><span class="mini im" style="--p:' +
          pos(stat(k).level) +
          '%">' +
          capePair(capeImg(k)) +
          '</span><b>' +
          esc(SKILL[k].n) +
          ' ' +
          stat(k).level +
          '</b><span class="rs">' +
          (dl ? fmt(Math.round(dl)) : h < 1 ? Math.round(h * 60) : fmt(Math.round(h))) +
          '</span><small>' +
          (dl ? 'days of runs' : h < 1 ? 'min' : 'hours') +
          (rough(k) ? ', rough' : '') +
          '</small></li>'
        );
      })
      .join('') +
    '</ul></section>'
  );
}
const fanHTML = (ks) =>
  '<div class="sw fan">' +
  ks
    .slice(0, 3)
    .map((k, i) => '<img src="' + capeImg(k) + '" alt="" style="--i:' + i + '">')
    .join('') +
  '</div>';

function dealPanelHTML() {
  const p = state.prefs;
  const keys = MOODS[p.mood] ? pool([p.mood]) : candidates();
  const top = (keys.length ? keys : skillList()).slice().sort((a, b) => stat(b).level - stat(a).level);
  return (
    '<section class="live deal">' +
    fanHTML(top) +
    '<div class="say"><h2>Tonight</h2><p class="note">Deal a session built from your levels, your quests and what you did last time.</p>' +
    '<div class="fields"><div class="field"><span class="lab">Time</span>' +
    chipSet(
      'minutes',
      [30, 60, 90, 120, 180, 240].map((n) => [n, n >= 60 ? n / 60 + ' h' : n + ' min']),
      p.minutes,
      'Time',
    ) +
    '</div>' +
    '<div class="field"><span class="lab">Mood</span>' +
    chipSet(
      'mood',
      [
        ['balanced', 'Balanced'],
        ['afk', 'AFK tonight'],
        ['active', 'Full attention'],
      ],
      p.mood,
      'Mood',
    ) +
    '<span class="help">' +
    (p.mood === 'afk'
      ? 'Every block is an AFK method.'
      : p.mood === 'active'
        ? 'Every block is an active method.'
        : 'Alternates AFK and active blocks.') +
    '</span></div></div>' +
    '<div class="acts"><button class="btn pri" data-act="deal">Deal tonight’s session</button><span class="help">' +
    (MOODS[p.mood]
      ? keys.length + ' skills with an ' + MOODS[p.mood] + ' method'
      : keys.length + ' skills in play') +
    ', ' +
    (p.dailies ? 'resets included' : 'resets off') +
    ', ' +
    (!p.wildcard
      ? 'no wildcard'
      : p.mood === 'afk'
        ? 'no wildcard on an AFK night'
        : p.minutes >= 90
          ? 'one wildcard'
          : 'wildcard from 90 min up') +
    '</span></div></div></section>'
  );
}

function blockFact(b) {
  if (b.kind === 'reset') return 'Timed run, about ' + b.minutes + ' minutes.';
  if (b.kind === 'wild') return 'Wildcard, ' + b.minutes + ' minutes. Whatever your account allows.';
  const s = stat(b.k);
  const next = s.level < 99 ? XP[s.level + 1] - s.xp : 0;
  const own =
    isIronman() &&
    METHODS[b.k] &&
    METHODS[b.k][b.mi] &&
    METHODS[b.k][b.mi][1] === b.title &&
    extra(METHODS[b.k][b.mi]).supply;
  return (
    esc(SKILL[b.k].n) +
    ' ' +
    s.level +
    ', ' +
    INTENSITY[b.int] +
    '. ' +
    (b.xph > 0
      ? b.est
        ? 'About ' +
          fmtK(b.xph) +
          ' xp an hour, worked out from your ' +
          (b.k === 'magic' || b.k === 'ranged' ? SKILL[b.k].n : 'Strength') +
          ' level.'
        : '≈ ' + fmtK(b.xph) + ' xp an hour.'
      : 'The wiki gives no hourly rate for this one.') +
    (own ? ' Uses your own supplies.' : '') +
    (next && b.xph > 0 && next <= b.target ? ' Level ' + (s.level + 1) + ' this block.' : '')
  );
}

function livePanelHTML(b, i) {
  const k = blockSkill(b),
    c = cape(k),
    el = blockElapsed(b),
    p = Math.min(1, el / (b.minutes * 60000));
  let bar = '';
  if (b.kind === 'skill') {
    const s = stat(k);
    if (s.level < 99) {
      const lo = XP[s.level],
        hi = XP[s.level + 1];
      bar =
        '<div class="bar"><div class="xp" style="--w:' +
        (((s.xp - lo) / (hi - lo)) * 100).toFixed(1) +
        '%;--fill:' +
        bright(k) +
        '"><i></i></div><span class="rs w">' +
        fmtK(hi - s.xp) +
        ' xp to level ' +
        (s.level + 1) +
        '</span></div>';
    }
  }
  return (
    '<section class="live" data-mk="' +
    i +
    '" style="' +
    (k ? '--cape:' + c[0] + ';--trim:' + c[1] + ';' : '') +
    '--p:' +
    p.toFixed(3) +
    '"><div class="sw">' +
    (k ? '<img src="' + capeImg(k) + '" alt="">' : '<span class="rs x4 w">?</span>') +
    '</div>' +
    '<div class="say"><h2>' +
    (k ? icon(k, 'l') : '') +
    esc(b.title) +
    '</h2><p class="fact">' +
    blockFact(b) +
    '</p>' +
    (b.note ? '<p class="note">' + esc(b.note) + '</p>' : '') +
    bar +
    '<div class="acts"><button class="btn pri" data-act="tb" data-i="' +
    i +
    '">' +
    (b.running ? 'Pause' : 'Start') +
    '</button><button class="btn" data-act="db" data-i="' +
    i +
    '">Done</button>' +
    (b.kind === 'skill'
      ? '<button class="btn ghost" data-act="rb" data-i="' +
        i +
        '" title="Swap this block for another skill">Swap</button>'
      : '') +
    '</div></div>' +
    '<div class="clk"><span class="rs x4" data-bt="' +
    i +
    '">' +
    clock(el) +
    '</span><small>of ' +
    b.minutes +
    ' min' +
    (b.running ? ', running' : el ? ', paused' : '') +
    '</small>' +
    (b.kind === 'skill' && b.xph > 0
      ? '<span class="rs w tgt">' +
        (b.est ? 'est. ' : '') +
        '+' +
        fmtK(b.target) +
        ' xp</span><small>this block</small>'
      : '') +
    '</div><i class="prog"></i></section>'
  );
}

function finishPanelHTML(s) {
  return (
    '<section class="live deal">' +
    fanHTML(s.blocks.map(blockSkill).filter(Boolean)) +
    '<div class="say"><h2>Finish and tally</h2><p class="note">Every block is done. Log out or hop worlds first so the hiscores catch up, then finish and the gains are counted.</p>' +
    '<div class="acts"><button class="btn pri" data-act="finish">Finish session and tally</button><button class="btn ghost" data-act="redeal">Deal again</button></div></div></section>'
  );
}

function lastSessionHTML(s) {
  const ks = Object.keys(s.gains || {}).sort((a, b) => s.gains[b] - s.gains[a]);
  const up = Object.keys(s.levels || {});
  return (
    '<section class="last"><div class="sec"><h3>' +
    (s.total > 0
      ? '<span class="rs" data-count="' + s.total + '">+' + fmtK(s.total) + '</span> xp last session'
      : 'No XP on the hiscores yet') +
    '</h3><span class="sub">' +
    clock(s.blocks.reduce((a, b) => a + b.elapsed, 0)) +
    ' on the clock' +
    (up.length ? ', ' + up.map((k) => (SKILL[k] ? SKILL[k].n : k) + ' +' + s.levels[k]).join(', ') : '') +
    '</span></div>' +
    (ks.length
      ? '<ul class="rsl">' +
        ks
          .map(
            (k) =>
              '<li>' +
              icon(k) +
              '<b>' +
              esc(SKILL[k] ? SKILL[k].n : k) +
              '</b><span class="rs" data-count="' +
              s.gains[k] +
              '">+' +
              fmtK(s.gains[k]) +
              '</span></li>',
          )
          .join('') +
        '</ul>'
      : '<p class="quiet">Hiscores update when you log out. Refresh in a minute and the gains will land in History.</p>') +
    '</section>'
  );
}

function queueHTML(s, liveI) {
  const el = s.blocks.reduce((a, b) => a + blockElapsed(b), 0);
  const planned = s.blocks.reduce((a, b) => a + b.minutes, 0);
  const doneN = s.blocks.filter((b) => b.done).length;
  const over = planned - s.minutes;
  let h =
    '<div class="sec"><h3>Tonight’s session</h3><span class="sub">' +
    new Date(s.t0).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ', ' +
    s.minutes +
    ' min, ' +
    doneN +
    ' of ' +
    s.blocks.length +
    ' done</span></div><div class="q">';
  s.blocks.forEach((b, i) => {
    const k = blockSkill(b),
      e = blockElapsed(b);
    const sub =
      b.kind === 'skill'
        ? esc(SKILL[b.k].n) + ', ' + INTENSITY[b.int]
        : b.kind === 'reset'
          ? 'Timed run'
          : 'Your pick';
    const tgt =
      b.kind === 'skill'
        ? b.xph > 0
          ? ', ' + (b.est ? 'est. ' : '') + '+' + fmtK(b.target) + ' xp'
          : ', no rate'
        : '';
    h +=
      '<div class="qc' +
      (b.done ? ' done' : '') +
      (i === liveI ? ' now' : '') +
      '" data-row="' +
      i +
      '"><b>' +
      esc(b.title) +
      '</b>' +
      blockIcon(b) +
      '<span class="sub">' +
      sub +
      '</span>' +
      '<div class="t">' +
      (b.done
        ? '<span class="rs g">Done</span>' + (e ? '<span class="rs w">' + clock(e) + '</span>' : '')
        : '<span class="rs">' +
          b.minutes +
          ' min' +
          tgt +
          '</span>' +
          (e && i !== liveI ? '<span class="rs w">' + clock(e) + ' logged</span>' : '')) +
      '</div>' +
      (b.done || i === liveI
        ? ''
        : '<div class="acts"><button class="btn sm" data-act="tb" data-i="' +
          i +
          '">' +
          (e ? 'Resume' : 'Start') +
          '</button><button class="btn sm ghost" data-act="db" data-i="' +
          i +
          '">Done</button>' +
          (b.kind === 'skill'
            ? '<button class="btn sm ghost" data-act="rb" data-i="' +
              i +
              '" title="Swap this block for another skill">Swap</button>'
            : '') +
          '</div>') +
      '</div>';
  });
  return (
    h +
    '</div><div class="acts under"><button class="btn" data-act="finish">Finish session and tally</button><button class="btn ghost" data-act="redeal">Deal again</button>' +
    '<span class="help">' +
    planned +
    ' of ' +
    s.minutes +
    ' min planned, <span class="rs w" data-total>' +
    clock(el) +
    '</span> logged</span>' +
    (over >= 5 ? '<span class="over">' + over + ' min over what you asked for</span>' : '') +
    '</div>'
  );
}

function tonightHTML() {
  const s = state.session;
  let main = '';
  if (!s || s.ended) {
    main = dealPanelHTML() + (s && s.ended ? lastSessionHTML(s) : '');
    if (!SYNC && !state.manual.allQuests && !Object.keys(state.manual.quests).length)
      main +=
        '<p class="hint"><b>Tick your quests first.</b> This site cannot read them for you, so it assumes none are done and leaves out every method behind a quest or diary. <a href="#" data-act="view" data-v="quests">Open Quests</a> and tick what you have finished; it takes a minute and the plan and the hours to max get more accurate.</p>';
    if (!state.history.length)
      main +=
        '<p class="hint"><b>How it works.</b> Every block is one skill, one method, one timer. Start the timer when you start, tick Done when you stop. When you finish the session, log out so the hiscores update, then press Finish and it tallies exactly what you gained.</p>';
  } else {
    const liveI = liveIndex();
    main = (liveI < 0 ? finishPanelHTML(s) : livePanelHTML(s.blocks[liveI], liveI)) + queueHTML(s, liveI);
  }
  return (
    '<div class="tonight"><div class="main">' +
    main +
    '</div><aside class="side">' +
    resetsSideHTML() +
    nextCapesHTML() +
    maxSideHTML() +
    '</aside></div>'
  );
}

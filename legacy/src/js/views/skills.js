/* Skills and Methods: the 1 to 99 strips, a skill's detail, and its method table. */

function stripHTML(k) {
  const s = stat(k);
  const stops = [...new Set((METHODS[k] || []).map((m) => m[0]).filter((l) => l > 1 && l < 99))];
  return (
    '<div class="strip" style="--c:' +
    bright(k) +
    '" role="img" aria-label="Level ' +
    s.level +
    ' of 99, ' +
    stops.filter((l) => l > s.level).length +
    ' method unlocks ahead"><i class="fill" style="width:' +
    pos(s.level) +
    '%"></i>' +
    stops
      .map((l) => '<i class="st' + (l <= s.level ? ' on' : '') + '" style="left:' + pos(l) + '%"></i>')
      .join('') +
    '<i class="me" style="left:' +
    pos(s.level) +
    '%"></i></div>'
  );
}

function skillsHTML() {
  const ks = skillList();
  const sort = state.prefs.sort;
  const arr = ks
    .slice()
    .sort((a, b) =>
      sort === 'level'
        ? stat(a).level - stat(b).level
        : sort === 'name'
          ? SKILL[a].n.localeCompare(SKILL[b].n)
          : (stat(a).level >= 99) - (stat(b).level >= 99) || hoursLeft(b) - hoursLeft(a),
    );
  let h =
    '<div class="sec"><h2>Skills</h2>' +
    chipSet(
      'sort',
      [
        ['hours', 'Most work left'],
        ['level', 'Lowest level'],
        ['name', 'A to Z'],
      ],
      sort,
      'Sort skills by',
    ) +
    '</div>' +
    '<table class="tt skills"><thead><tr><th><span class="vh">Icon</span></th><th>Skill</th><th class="num">Level</th><th>1 to 99, with a stop at each method unlock</th><th class="num c-to">To 99</th><th class="num c-time">Time left</th><th class="c-best">Best now</th></tr></thead><tbody>';
  arr.forEach((k) => {
    const s = stat(k);
    const maxed = s.level >= 99;
    const g = pace(k, 7).perDay;
    const m = topMethod(k);
    const dl = daysLeft(k);
    h +=
      '<tr class="' +
      (selected === k ? 'on' : '') +
      (maxed ? ' maxed' : '') +
      '" data-act="sel" data-k="' +
      k +
      '"><td class="c-lv">' +
      icon(k) +
      '</td><td class="blk"><button class="rowbtn" aria-expanded="' +
      (selected === k) +
      '">' +
      esc(SKILL[k].n) +
      '</button>' +
      (g > 0 ? '<span class="gain">+' + fmtK(g) + ' a day</span>' : '') +
      '</td>' +
      '<td class="num"><span class="rs">' +
      s.level +
      '</span></td><td class="c-line">' +
      stripHTML(k) +
      '</td>' +
      '<td class="num c-to">' +
      (maxed ? fmtK(s.xp) + ' xp' : fmtK(remain(k))) +
      '</td><td class="num c-time">' +
      (maxed
        ? 'maxed'
        : isPassive(k)
          ? 'with combat'
          : dl
            ? Math.round(dl) + ' days of runs'
            : hrs(hoursLeft(k)) +
              (rough(k) ? ', rough' : isIronman() && m && m.supply ? ', if supplied' : '')) +
      '</td><td class="c-best">' +
      (maxed ? '' : isPassive(k) ? 'Trained by combat' : m ? esc(m.n) : '') +
      '</td></tr>';
  });
  h += '</tbody></table>';
  if (selected && SKILL[selected]) h += detailHTML(selected);
  return h;
}

function detailHTML(k) {
  const s = stat(k);
  const ms = methods(k);
  const now = topMethod(k);
  const nx = nextUnlock(k);
  const dl = daysLeft(k);
  const p7 = pace(k, 7);
  const qs = QUESTS.filter((q) => q.xp[k] && !questDone(q.n)).sort((a, b) => b.xp[k] - a.xp[k]);
  const c = cape(k);
  let h =
    '<section class="detail"><div class="d-head"><div class="crest" style="--cape:' +
    c[0] +
    ';--trim:' +
    c[1] +
    '"><img src="' +
    capeImg(k, s.level >= 99) +
    '" alt=""><span class="rs x4">' +
    s.level +
    '</span></div><h3>' +
    icon(k, 'l') +
    esc(SKILL[k].n) +
    '</h3>' +
    '<p>' +
    fmt(s.xp) +
    ' xp. ' +
    (s.level >= 99
      ? 'Maxed.'
      : fmt(remain(k)) + ' to 99, ' + fmtK(XP[s.level + 1] - s.xp) + ' to ' + (s.level + 1) + '.') +
    '</p>' +
    (s.level < 99
      ? '<p>' +
        (isPassive(k)
          ? 'Trains itself through combat. It needs no plan of its own.'
          : now
            ? 'Best now: <b>' +
              esc(now.n) +
              '</b> at ' +
              (now.est ? 'an estimated ' : '≈') +
              fmtK(now.xph) +
              '/h' +
              (now.run ? ' of time spent on the runs' : '') +
              ', about ' +
              (dl ? Math.round(dl) + ' days at one of each run a day' : hrs(hoursLeft(k))) +
              ' to 99.' +
              (rough(k) ? ' The wiki gives no hourly rate for part of that, so it is a rough figure.' : '') +
              (isIronman() && now.supply ? ' That rate only holds while your own supplies last.' : '')
            : 'No method available yet. Check the requirements in the table.') +
        (p7.perDay > 0 ? ' Your 7-day pace is ' + fmtK(p7.perDay) + ' a day.' : '') +
        '</p>'
      : '') +
    (nx && s.level < 99
      ? '<p>Next unlock: <b>' +
        esc(nx.n) +
        '</b>' +
        (nx.lv > s.level ? ' at level ' + nx.lv : '') +
        (nx.miss.length ? ', needs ' + esc(nx.miss.join(', ')) : '') +
        '.</p>'
      : '') +
    (qs.length && s.level < 99
      ? '<p>Quests still owing XP here: ' +
        qs
          .slice(0, 5)
          .map((q) => '<b>' + esc(q.n) + '</b> ' + fmtK(q.xp[k]))
          .join(', ') +
        '.</p>'
      : '') +
    '</div>' +
    (ms.length
      ? '<div class="twrap"><table class="tt methods rows-top"><thead><tr><th class="num">Level</th><th>Method</th><th class="num">Rate</th><th>Pace</th><th>' +
        (isIronman() ? 'Supplies' : 'Cost') +
        '</th></tr></thead><tbody>' +
        ms
          .map(
            (m) =>
              '<tr class="' +
              (m.ok ? '' : 'locked') +
              (now && m.i === now.i ? ' best' : '') +
              '"><td class="num lvl">' +
              m.lv +
              '</td><td class="blk"><b>' +
              esc(m.n) +
              '</b>' +
              (now && m.i === now.i ? '<span class="mark">Best now</span>' : '') +
              (m.run ? '<span class="mark">Run</span>' : '') +
              (m.tick ? '<span class="mark">Tick-perfect</span>' : '') +
              '<span>' +
              esc(m.note) +
              (m.miss.length ? ' <em class="needs">Needs ' + esc(m.miss.join(', ')) + '.</em>' : '') +
              '</span></td>' +
              '<td class="num">' +
              (m.run && m.per
                ? '≈ ' + fmtK(m.per) + ' a run'
                : m.xph
                  ? (m.est ? 'est. ' : '≈ ') + fmtK(m.xph) + '/h'
                  : 'no rate') +
              '</td><td>' +
              paceTag(m.int) +
              '</td><td class="nowrap">' +
              (isIronman() ? (m.supply ? 'your own' : 'none') : COST[m.cost]) +
              '</td></tr>',
          )
          .join('') +
        '</tbody></table></div>'
      : '') +
    '</section>';
  return h;
}

function methodsHTML() {
  const ks = skillList().filter((k) => METHODS[k]);
  const k = selected && METHODS[selected] ? selected : ks[0];
  return (
    '<div class="sec"><h2>Methods</h2><span class="sub">Every method, with what your account is missing.' +
    (HOSTED
      ? ' <button class="btn sm ghost" data-act="suggest" data-k="' + k + '">Missing one? Suggest it</button>'
      : '') +
    '</span></div><div class="chips pick">' +
    ks
      .map(
        (x) =>
          '<button class="chip' +
          (x === k ? ' on' : '') +
          '" data-act="sel" data-k="' +
          x +
          '" aria-pressed="' +
          (x === k) +
          '">' +
          icon(x) +
          esc(SKILL[x].n) +
          '</button>',
      )
      .join('') +
    '</div>' +
    detailHTML(k)
  );
}

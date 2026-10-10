/* Quests: XP still on offer, the quests that unlock methods, and the diary grid. */

function questsHTML() {
  const done = (q) => questDone(q.n);
  const undone = QUESTS.filter((q) => !done(q))
    .map((q) =>
      Object.assign({}, q, { tot: Object.values(q.xp).reduce((a, b) => a + b, 0) + (q.lampXp || 0) }),
    )
    .sort((a, b) => b.tot - a.tot);
  const short = (q) =>
    Object.keys(q.need || {})
      .filter((k) => stat(k).level < q.need[k])
      .map((k) => q.need[k] + ' ' + SKILL[k].n);
  const gating = new Set();
  for (const k in METHODS) METHODS[k].forEach((m) => parseReq(m[5]).q.forEach((q) => gating.add(q)));
  RESETS.forEach((r) => parseReq(r.req).q.forEach((q) => gating.add(q)));
  WILDCARDS.forEach((w) => w.req && parseReq(w.req).q.forEach((q) => gating.add(q)));
  const regions = [
    'Ardougne',
    'Desert',
    'Falador',
    'Fremennik',
    'Kandarin',
    'Karamja',
    'Kourend & Kebos',
    'Lumbridge & Draynor',
    'Morytania',
    'Varrock',
    'Western Provinces',
    'Wilderness',
  ];
  const tiers = ['Easy', 'Medium', 'Hard', 'Elite'];
  let h = !SYNC
    ? '<div class="status"><p><b>Quests and diaries are ticked by hand.</b> The hiscores list your levels but not your quests, and there is no public source for those. Tick what you have done below, or use the two shortcuts. Until you do, methods behind a quest or diary count as locked, so your hours to max read high.</p></div>'
    : '<div class="status' +
      (state.ws ? '' : ' warn') +
      '"><p>' +
      (state.ws
        ? '<b>WikiSync.</b> ' +
          Object.values(state.ws.quests).filter((v) => v === 2).length +
          ' quests complete, synced ' +
          ago(state.ws.fetched) +
          '.'
        : '<b>No WikiSync data yet.</b> Install the WikiSync plugin in RuneLite, log in once, then sync. Or tick things by hand below.') +
      '</p><button class="btn sm" data-act="wiki">Sync WikiSync</button></div>';
  h +=
    '<div class="chips"><button class="chip' +
    (state.manual.allQuests ? ' on' : '') +
    '" data-act="toggle" data-p="allQuests" aria-pressed="' +
    !!state.manual.allQuests +
    '">Quest cape: every quest done</button><button class="chip' +
    (state.manual.allDiaries ? ' on' : '') +
    '" data-act="toggle" data-p="allDiaries" aria-pressed="' +
    !!state.manual.allDiaries +
    '">Every diary done</button></div>';
  h +=
    '<div class="two"><div><div class="sec"><h2>Worth doing for XP</h2><span class="sub">' +
    undone.length +
    ' left, biggest first</span></div>' +
    (undone.length
      ? '<table class="tt rows-top"><thead><tr><th>Quest</th><th class="num">XP</th><th class="act"><span class="vh">Mark done</span></th></tr></thead><tbody>' +
        undone
          .map(
            (q) =>
              '<tr><td class="blk"><b>' +
              esc(q.n) +
              '</b><span class="worn">' +
              Object.keys(q.xp)
                .map((k) => icon(k, '', SKILL[k].n))
                .join('') +
              '</span><span>' +
              Object.keys(q.xp)
                .map((k) => SKILL[k].n + ' ' + fmtK(q.xp[k]))
                .join(', ') +
              (q.lamps ? (Object.keys(q.xp).length ? '. ' : '') + esc(q.lamps) : '') +
              (q.mini ? '<em class="aside">Miniquest.</em>' : '') +
              (short(q).length
                ? '<em class="needs own">Short of ' + esc(short(q).join(', ')) + '.</em>'
                : '') +
              '</span></td><td class="num">' +
              (q.tot ? '<span class="rs">' + fmtK(q.tot) + '</span>' : '') +
              '</td><td class="act"><button class="btn sm" data-act="tq" data-q="' +
              esc(q.n) +
              '">Mark done</button></td></tr>',
          )
          .join('') +
        '</tbody></table>'
      : '<p class="quiet">Every XP quest on the list is done.</p>') +
    '</div>';
  h +=
    '<div><div class="sec"><h2>Unlocks</h2><span class="sub">Quests that gate a method or a reset</span></div><table class="tt"><tbody>' +
    [...gating]
      .sort()
      .map((q) => {
        const d = questDone(q);
        return (
          '<tr class="' +
          (d ? '' : 'locked') +
          '"><td class="blk"><b>' +
          esc(q) +
          '</b></td><td class="act"><button class="chip' +
          (d ? ' on' : '') +
          '" data-act="tq" data-q="' +
          esc(q) +
          '" aria-pressed="' +
          d +
          '">' +
          (d ? 'Done' : 'Not done') +
          '</button></td></tr>'
        );
      })
      .join('') +
    '</tbody></table>';
  h +=
    '<div class="sec"><h2>Diaries</h2><span class="sub">Tick a box to mark a tier done</span></div><table class="tt matrix"><thead><tr><th>Region</th>' +
    tiers.map((t) => '<th>' + t + '</th>').join('') +
    '</tr></thead><tbody>' +
    regions
      .map(
        (r) =>
          '<tr><td class="blk"><b>' +
          esc(r) +
          '</b></td>' +
          tiers
            .map((t) => {
              const on = diaryDone(r + ' ' + t);
              return (
                '<td><button class="box' +
                (on ? ' on' : '') +
                '" data-act="td" data-d="' +
                esc(r + ' ' + t) +
                '" aria-pressed="' +
                on +
                '" aria-label="' +
                esc(r + ' ' + t) +
                (on ? ', done' : ', not done') +
                '"></button></td>'
              );
            })
            .join('') +
          '</tr>',
      )
      .join('') +
    '</tbody></table></div></div>';
  return h;
}

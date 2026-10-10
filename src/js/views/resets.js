/* Resets: timed runs and dailies, with when each is next due. */

function resetsHTML() {
  let h =
    '<div class="sec"><h2>Resets</h2><span class="sub">Passive XP on a timer. Tick them as you do them and the session builder slots them in when they are due.</span></div><table class="tt rows-top"><thead><tr><th><span class="vh">Icon</span></th><th>Reset</th><th>Every</th><th>Status</th><th class="act"><span class="vh">Mark done</span></th></tr></thead><tbody>';
  const everyText = (r) => {
    const e = resetEvery(r);
    return e === 'utc'
      ? 'Daily, 00:00 UTC'
      : e === 'weekly'
        ? 'Every 7 days'
        : e < 120
          ? e + ' min'
          : e < 2880
            ? +(e / 60).toFixed(1) + ' h'
            : +(e / 1440).toFixed(1) + ' days';
  };
  RESETS.filter(resetMine).forEach((r) => {
    const miss = reqState(r.req);
    const d = resetDue(r);
    h +=
      '<tr class="' +
      (miss.length ? 'locked' : '') +
      '"><td class="c-lv">' +
      icon(r.skill) +
      '</td><td class="blk"><b>' +
      esc(r.n) +
      '</b><span>' +
      esc(r.note) +
      (miss.length ? ' <em class="needs">Needs ' + esc(miss.join(', ')) + '.</em>' : '') +
      '</span></td>' +
      '<td class="nowrap">' +
      everyText(r) +
      '</td><td class="nowrap">' +
      (miss.length
        ? '<span class="mark">Locked</span>'
        : d.due
          ? '<span class="rs g">Due</span> ' + esc(d.text.replace(/^due,? ?/, ''))
          : esc(d.text)) +
      '</td>' +
      '<td class="act">' +
      (miss.length ? '' : '<button class="btn sm" data-act="rd" data-k="' + r.k + '">Done now</button>') +
      '</td></tr>';
  });
  return h + '</tbody></table>';
}

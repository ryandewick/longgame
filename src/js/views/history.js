/* History: XP per day over two weeks and the list of finished sessions. */

function historyHTML() {
  const days = dailyGains(14);
  const top = Math.max(1, ...days.map((d) => d.gain));
  const week = days.slice(-7).reduce((a, d) => a + d.gain, 0);
  const pl = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  let h =
    '<div class="sec"><h2>Last 14 days</h2><span class="sub">XP per day from your snapshots. Refresh stats after playing and the bars fill in.</span></div>' +
    '<p class="lede"><span class="rs">+' +
    fmtK(week) +
    '</span> xp this week. ' +
    pl(streak(), 'day') +
    ' in a row. ' +
    pl(state.history.length, 'session') +
    ' finished, ' +
    pl(snaps.length, 'snapshot') +
    ' taken.</p>' +
    '<div class="chart" role="img" aria-label="XP gained per day over the last 14 days"><div class="bars">' +
    days
      .map(
        (d, i) =>
          '<div class="b' +
          (i === days.length - 1 ? ' today' : '') +
          '" title="' +
          d.key +
          ' +' +
          fmtK(d.gain) +
          '">' +
          (d.gain > 0 ? '<em class="rs">+' + fmtK(d.gain) + '</em>' : '') +
          '<i style="height:' +
          ((d.gain / top) * 100).toFixed(1) +
          '%"></i></div>',
      )
      .join('') +
    '</div>' +
    '<div class="days">' +
    days
      .map((d, i) => '<span' + (i === days.length - 1 ? ' class="today"' : '') + '>' + d.label + '</span>')
      .join('') +
    '</div></div>';
  h += '<div class="sec"><h2>Sessions</h2></div>';
  if (!state.history.length) return h + '<p class="quiet">No sessions yet. Deal one in Tonight.</p>';
  h +=
    '<div class="twrap"><table class="tt"><thead><tr><th>When</th><th>Blocks</th><th class="num">Logged</th><th class="num">Gained</th><th>Levels</th></tr></thead><tbody>' +
    state.history
      .map(
        (x) =>
          '<tr><td class="nowrap">' +
          new Date(x.t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
          '</td><td><span class="worn">' +
          x.blocks
            .map((b) =>
              blockIcon(b, b.kind === 'skill' && SKILL[b.k] ? SKILL[b.k].n + ': ' + b.title : b.title),
            )
            .join('') +
          '</span></td><td class="num">' +
          clock(x.elapsed) +
          '</td><td class="num">' +
          (x.total ? '<span class="rs">+' + fmtK(x.total) + '</span>' : 'none yet') +
          '</td><td>' +
          Object.keys(x.levels || {})
            .map((k) => (SKILL[k] ? SKILL[k].n : k) + ' +' + x.levels[k])
            .join(', ') +
          '</td></tr>',
      )
      .join('') +
    '</tbody></table></div>';
  return h;
}

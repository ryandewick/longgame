/* First run: the name box under a demonstration rack. */

function setupHTML() {
  // the rack as it will look part-way through: every cape on the rail, each a little fuller than the last
  const ks = SKILLS.map((s) => s.k);
  const n = ks.length;
  return (
    '<div class="setup"><header class="top"><div class="wrap"><span class="brand" role="img" aria-label="Long Game">' +
    brandHTML(0.75) +
    '</span></div></header>' +
    '<section class="stage"><div class="wrap"><div class="stage-top"><h1>Every skillcape on one rail.</h1><p>Each one fills with colour as you level. The max cape waits at the end.</p></div>' +
    '<div class="capes" style="--n:' +
    n +
    '">' +
    ks
      .map((k, i) => {
        const l = i === n - 1 ? 99 : Math.round(30 + i * (66 / (n - 1)));
        return (
          '<span class="c' +
          (l >= 99 ? ' max' : '') +
          '"><span class="im" style="--p:' +
          pos(l) +
          '%">' +
          capePair(capeImg(k, l >= 99)) +
          '</span><b class="rs">' +
          l +
          '</b></span>'
        );
      })
      .join('') +
    '<i class="sp"></i><i class="sp"></i><span class="goal"><span class="im" style="--p:38%">' +
    capePair(ASSETS + 'capes-md/max.webp') +
    '</span><b class="rs w">Max cape</b></span></div></div></section>' +
    '<main class="wrap"><section class="live deal"><div class="sw fan">' +
    ['fishing', 'firemaking', 'woodcutting']
      .map((k, i) => '<img src="' + capeImg(k) + '" alt="" style="--i:' + i + '">')
      .join('') +
    '</div><div class="say"><h1>Start with your name</h1>' +
    '<p class="note">Long Game pulls your stats from the hiscores' +
    (SYNC ? ' and your quests and diaries from WikiSync' : '') +
    ', then deals you sessions built from what your account can actually do tonight.</p>' +
    '<div class="fields"><div class="field"><label class="lab" for="rsn">RuneScape name</label><div class="inline"><input class="in" id="rsn" placeholder="your RSN" value="' +
    esc(state.name) +
    '" autocomplete="off" spellcheck="false" autofocus><button class="btn pri" data-act="setname"' +
    (busy ? ' disabled' : '') +
    '>' +
    (busy ? 'Fetching…' : 'Load my account') +
    '</button></div>' +
    '<span class="help">' +
    (HOSTED
      ? 'Your name is looked up on the official hiscores. Everything else stays in this browser.'
      : SERVER
        ? 'Running locally. Nothing leaves this machine except the two lookups.'
        : 'Open this through Long Game.bat so it can fetch for you.') +
    '</span></div></div></div></section></main>' +
    (HOSTED ? '' : footHTML()) +
    '</div>'
  );
}

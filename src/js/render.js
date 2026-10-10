/* Drawing the page: picks the view, writes it into #app, and builds the top bar. */

function render() {
  const app = $('#app');
  if (!state) return;
  memo = {};
  document.documentElement.classList.toggle('lg-in', !!(state.name && state.hs)); // the website hides its product description once an account is loaded
  if (!state.name || !state.hs) {
    app.innerHTML = setupHTML();
    if (cue && !still()) fillRack();
    cue = null;
    return;
  }
  const views = {
    tonight: tonightHTML,
    skills: skillsHTML,
    methods: methodsHTML,
    quests: questsHTML,
    resets: resetsHTML,
    history: historyHTML,
    settings: settingsHTML,
  };
  const now = liveIndex();
  const pct = maxStats().pct / 100;
  const nowK =
    view === 'skills'
      ? selected
      : view === 'tonight' && now >= 0
        ? blockSkill(state.session.blocks[now])
        : null;
  app.innerHTML =
    topHTML(pct) +
    (view === 'tonight' || view === 'skills' ? rackHTML(nowK) : '') +
    '<main class="wrap">' +
    (views[view] || tonightHTML)() +
    '</main>' +
    footHTML();
  setFavicon(pct);
  if (cue && cue[0] === 'boot') {
    if (view === 'tonight' || view === 'skills') animate('boot');
  } else if (view === 'tonight') {
    if (cue) animate(cue[0], cue[1]);
    else if (lastLive !== null && now >= 0 && now !== lastLive) animate('live');
  }
  cue = null;
  lastLive = now;
}

function topHTML(pct) {
  const tabs = [
    ['tonight', 'Tonight'],
    ['skills', 'Skills'],
    ['methods', 'Methods'],
    ['quests', 'Quests'],
    ['resets', 'Resets'],
    ['history', 'History'],
    ['settings', 'Settings'],
  ];
  return (
    '<header class="top"><div class="wrap"><a class="brand" href="#" data-act="view" data-v="tonight" aria-label="Long Game">' +
    brandHTML(pct) +
    '</a>' +
    '<div class="who"><b>' +
    esc(state.name) +
    '</b><span>' +
    (isIronman() ? 'Ironman, ' : '') +
    'stats ' +
    ago(state.hs.fetched) +
    (SYNC ? ', ' + (state.ws ? 'quests synced ' + ago(state.ws.fetched) : 'quests by hand') : '') +
    '</span></div>' +
    '<button class="btn sm" data-act="refresh"' +
    (busy ? ' disabled' : '') +
    '>' +
    (busy ? 'Fetching…' : 'Refresh stats') +
    '</button>' +
    '<nav class="nav" aria-label="Views">' +
    tabs
      .map(
        (t) =>
          '<button' +
          (view === t[0] ? ' class="on" aria-current="page"' : '') +
          ' data-act="view" data-v="' +
          t[0] +
          '">' +
          t[1] +
          '</button>',
      )
      .join('') +
    '</nav></div></header>'
  );
}

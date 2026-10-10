/* Events and start-up: one click handler for every action, the timer tick, and boot. */

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !state) return;
  const a = el.dataset.act;
  switch (a) {
    case 'view':
      e.preventDefault();
      if (el.dataset.v === view) {
        window.scrollTo({ top: 0 });
        break;
      }
      go(() => {
        view = el.dataset.v;
        history.replaceState(null, '', '#' + view);
        render();
        window.scrollTo({ top: 0 });
      });
      break;
    case 'setname': {
      const n = ($('#rsn')?.value || '').trim();
      if (!n) {
        toast('Type your name first.', '');
        return;
      }
      if (n !== state.name) {
        state.name = n;
        state.hs = null;
        state.ws = null;
        state.session = null;
        state.history = [];
        state.rotation = [];
        state.prefs.account = null;
        snaps = [];
      }
      save();
      await refresh();
      if (state.hs) {
        view = 'tonight';
        render();
      }
      break;
    }
    case 'refresh':
      await refresh();
      break;
    case 'wiki':
      await syncWiki(false);
      render();
      break;
    case 'pref':
      state.prefs[el.dataset.k] = isNaN(+el.dataset.v) ? el.dataset.v : +el.dataset.v;
      save();
      render();
      break;
    case 'prefbool':
      state.prefs[el.dataset.k] = !state.prefs[el.dataset.k];
      save();
      render();
      break;
    case 'excl':
      state.prefs.exclude[el.dataset.k] = !state.prefs.exclude[el.dataset.k];
      save();
      render();
      break;
    case 'sel':
      selected = selected === el.dataset.k && view === 'skills' ? null : el.dataset.k;
      render();
      if (view === 'skills') {
        const d = $('.detail');
        if (d) d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      break;
    case 'cape': {
      const k = el.dataset.k,
        same = view === 'skills';
      const f = () => {
        view = 'skills';
        selected = k;
        history.replaceState(null, '', '#skills/' + k);
        render();
        const d = $('.detail');
        if (d) d.scrollIntoView({ behavior: same ? 'smooth' : 'auto', block: 'nearest' });
      };
      same ? f() : go(f);
      break;
    }
    case 'share':
      shareRack(el);
      break;
    case 'deal':
      dealSession();
      break;
    case 'redeal':
      ask('Deal again', 'Throw away tonight’s blocks and deal a fresh set?', 'Deal again').then((ok) => {
        if (ok) dealSession();
      });
      break;
    case 'tb':
      toggleBlock(+el.dataset.i);
      break;
    case 'db':
      doneBlock(+el.dataset.i);
      break;
    case 'rb':
      rerollBlock(+el.dataset.i);
      break;
    case 'finish':
      finishSession();
      break;
    case 'tq': {
      const q = el.dataset.q;
      state.manual.quests[q] = !questDone(q);
      if (!state.manual.quests[q]) delete state.manual.quests[q];
      save();
      render();
      break;
    }
    case 'td': {
      const d = el.dataset.d;
      state.manual.diaries[d] = !diaryDone(d);
      if (!state.manual.diaries[d]) delete state.manual.diaries[d];
      save();
      render();
      break;
    }
    case 'toggle':
      state.manual[el.dataset.p] = !state.manual[el.dataset.p];
      save();
      render();
      break;
    case 'rd':
      state.resets[el.dataset.k] = Date.now();
      save();
      render();
      toast('Logged. The timer restarts now.', '');
      break;
    case 'export': {
      const u = URL.createObjectURL(
        new Blob([JSON.stringify({ longgame: 1, state: state, snaps })], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = u;
      a.download = 'longgame-' + state.name.replace(/[^\w-]+/g, '_') + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
      break;
    }
    case 'import':
      importFile();
      break;
    case 'suggest':
      suggestForm(el.dataset.k);
      break;
    case 'forget':
      ask(
        'Forget this account',
        'Stats, sessions and manual ticks go. ' +
          (SERVER ? 'Snapshots on disk stay.' : 'Your XP history stays in this browser.'),
        'Forget',
      ).then((ok) => {
        if (ok) {
          state = blank();
          save();
          view = 'tonight';
          render();
        }
      });
      break;
  }
});
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1).split('/');
  if (state && h[0] && (h[0] !== view || (h[1] && h[1] !== selected))) {
    view = h[0];
    if (h[1]) selected = h[1];
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'rsn') {
    const b = document.querySelector('[data-act=setname]');
    if (b) b.click();
  }
});
setInterval(() => {
  if (!state || !state.session || state.session.ended) return;
  let tot = 0;
  state.session.blocks.forEach((b, i) => {
    const e = blockElapsed(b);
    tot += e;
    if (!b.running) return;
    document.querySelectorAll('[data-bt="' + i + '"]').forEach((el) => {
      el.textContent = clock(e);
    });
    const m = document.querySelector('[data-mk="' + i + '"]');
    if (m) m.style.setProperty('--p', Math.min(1, e / (b.minutes * 60000)).toFixed(3));
  });
  const t = document.querySelector('[data-total]');
  if (t) t.textContent = clock(tot);
}, 1000);

(async function boot() {
  state = await loadState();
  if (!state.prefs) state = Object.assign(blank(), state);
  if (state.name && SERVER) {
    try {
      snaps = await api('/api/snapshots?name=' + encodeURIComponent(state.name));
    } catch (e) {}
  } else if (state.name && HOSTED) snaps = loadSnaps(state.name);
  const hv = location.hash.slice(1).split('/');
  if (hv[0]) view = hv[0];
  if (hv[1]) selected = hv[1]; // a reload keeps the tab you were on
  cue = ['boot'];
  render();
  if (state.name && state.hs && Date.now() - state.hs.fetched > 30 * 60000) refresh({ ws: !state.ws });
})();

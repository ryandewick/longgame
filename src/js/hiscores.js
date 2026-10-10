/* Fetching: the hiscores lookup, and the optional private quest lookup. */

function parseHs(j) {
  const skills = {};
  let total = { level: 0, xp: 0 };
  j.skills.forEach((s) => {
    const k = s.name.toLowerCase().replace(/\s+/g, '');
    if (s.name === 'Overall') {
      total = { level: s.level, xp: Math.max(0, s.xp) };
      return;
    }
    skills[k] = { n: s.name, level: Math.max(1, s.level), xp: Math.max(0, s.xp), rank: s.rank };
  });
  const acts = {};
  (j.activities || []).forEach((a) => {
    acts[a.name] = a.score;
  });
  return { fetched: Date.now(), skills, total, acts };
}

async function refresh(opts) {
  if (busy) return;
  busy = true;
  render();
  try {
    const j = await api(API + '/api/hiscores?name=' + encodeURIComponent(state.name));
    const hs = parseHs(j);
    const prev = state.hs;
    state.hs = hs;
    const skills = {};
    for (const k in hs.skills) skills[k] = hs.skills[k].xp;
    if (ONLINE && !state.prefs.account) {
      try {
        const a = await api(API + '/api/acctype?name=' + encodeURIComponent(state.name));
        if (a && a.type) state.prefs.account = a.type === 'main' ? 'main' : 'iron';
      } catch (e) {}
    }
    if (SERVER) {
      try {
        await api('/api/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: state.name, skills, total: hs.total.xp }),
        });
        snaps = await api('/api/snapshots?name=' + encodeURIComponent(state.name));
      } catch (e) {}
    } else if (HOSTED) snaps = pushSnap(state.name, skills, hs.total.xp);
    if (SYNC && (!opts || opts.ws !== false)) await syncWiki(true);
    save();
    if (prev) {
      const g = Object.keys(hs.skills)
        .map((k) => hs.skills[k].xp - (prev.skills[k] ? prev.skills[k].xp : 0))
        .reduce((a, b) => a + Math.max(0, b), 0);
      toast(
        g > 0
          ? 'Stats updated. +' + fmtK(g) + ' XP since last time.'
          : 'Stats updated. Nothing new since last time.',
        '',
      );
    }
  } catch (e) {
    toast(e.message || 'Could not fetch.', '');
  }
  busy = false;
  render();
}

async function syncWiki(quiet) {
  if (!SYNC) return;
  let data = null,
    err = null;
  try {
    data = await window.LGSync(state.name);
  } catch (e) {
    err = e.message;
  }
  if (data && data.quests) {
    state.ws = {
      fetched: Date.now(),
      quests: data.quests,
      achievement_diaries: data.achievement_diaries || {},
      ca: data.combat_achievements || [],
    };
    state.wsError = null;
    if (!quiet)
      toast(
        'WikiSync loaded. ' + Object.values(data.quests).filter((v) => v === 2).length + ' quests complete.',
        '',
      );
  } else {
    state.wsError = err || 'no data';
    if (!quiet)
      toast(
        'No WikiSync data for this name. Install the WikiSync plugin in RuneLite and log in once, or tick quests by hand.',
        '',
      );
  }
  save();
}

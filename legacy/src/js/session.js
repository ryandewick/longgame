/* Dealing a session: which skills get a block tonight, which method each block uses, and the timers. */

function candidates() {
  return skillList().filter((k) => stat(k).level < 99 && !state.prefs.exclude[k] && pickable(k).length);
}

/* The mood decides which intensities a block may use, in order of preference.
   AFK tonight: AFK methods only. Full attention: active only. Balanced: alternates, and semi-AFK fills either side when it must. */

function tiersFor(mood, i, flip) {
  if (mood === 'afk') return [['afk']];
  if (mood === 'active') return [['active']];
  return (i + (flip ? 1 : 0)) % 2 === 0 ? [['active'], ['semi'], ['afk']] : [['afk'], ['semi'], ['active']];
}

/* methods of these intensities this account can grind now: rated ones, or the last one unlocked when the wiki rates none */
function fits(k, ints) {
  if (isPassive(k)) return [];
  const ok = methods(k).filter((m) => m.ok && !m.run && !m.start && noTicks(m) && ints.includes(m.int));
  const rated = ok.filter((m) => m.xph > 0);
  return cheapOnly(rated.length ? rated : ok.slice(-1));
}

/* the method a block of these intensities gets. An AFK block weighs effort as well as XP: a method with per-trip setup
   (Nightmare Zone's dream fee, potions and quest list) counts for three quarters of its rate. skip: activities already in the session. */
const act = (n) => n.replace(/ with .*$/, ''); // the activity, whatever the style: 'Gemstone Crab with Dorgeshuun crossbow' is still the crab

function pickFor(k, ints, skip) {
  const v = (m) => (isIronman() && m.supply ? 0.6 : 1) * (ints.includes('afk') && m.setup ? 0.75 : 1) * m.xph;
  return (
    fits(k, ints)
      .filter((m) => !skip || !skip.has(act(m.n)))
      .sort((a, b) => v(b) - v(a))[0] || null
  );
}
const pool = (ints, skip) =>
  skillList().filter((k) => stat(k).level < 99 && !state.prefs.exclude[k] && pickFor(k, ints, skip));

/* how much a skill is worth dealing: work left, scaled by how good the allowed method is next to the skill's best */
function weightFor(k, m, minutes, recent) {
  const best = rateAt(k, stat(k).level);
  let x =
    Math.pow(hoursLeft(k) + 1, 0.8) *
    (m.xph > 0 && best > 0 ? Math.max(0.1, Math.min(1, m.xph / best)) : 0.5);
  if (recent.includes(k)) x *= 0.45;
  const s = stat(k);
  if (m.xph > 0 && XP[s.level + 1] - s.xp < (m.xph * minutes) / 60) x *= 1.3;
  return x;
}
const MOODS = { afk: 'AFK', active: 'active' };

function dealSession() {
  const minutes = state.prefs.minutes,
    mood = state.prefs.mood;
  let count = Math.max(1, Math.min(6, Math.round(minutes / 40)));
  const blocks = [];
  let left = minutes;
  if (state.prefs.dailies) {
    const due = RESETS.filter((r) => resetMine(r) && !reqState(r.req).length && resetDue(r).due).slice(0, 2);
    due.forEach((r) => {
      blocks.push({
        kind: 'reset',
        k: r.k,
        title: r.n,
        note: r.note,
        minutes: 5,
        int: 'reset',
        skill: r.skill,
      });
      left -= 5;
    });
  }
  // no wildcard is AFK, so an AFK night has none
  let wild = null;
  if (state.prefs.wildcard && minutes >= 90 && mood !== 'afk') {
    const ws = WILDCARDS.filter((w) => !w.req || !reqState(w.req).length);
    wild = ws[Math.floor(Math.random() * ws.length)];
    left -= 15;
  }
  const recent = state.rotation.slice(-3);
  const used = new Set(),
    titles = new Set();
  const skills = []; // titles: one block per activity, so Nightmare Zone is not dealt for three stats
  const fill = (tiers) => {
    for (let i = skills.length; i < count; i++) {
      let got = null;
      for (const ints of tiers(i)) {
        const cs = pool(ints, titles).filter((k) => !used.has(k));
        if (!cs.length) continue;
        const ms = cs.map((k) => pickFor(k, ints, titles));
        const k = wpick(
          cs,
          cs.map((k, j) => weightFor(k, ms[j], left / count, recent)),
        );
        got = { k, m: ms[cs.indexOf(k)], want: ints };
        break;
      }
      if (!got) break;
      used.add(got.k);
      titles.add(act(got.m.n));
      skills.push(got);
    }
  };
  const flip = Math.random() < 0.5;
  fill((i) => tiersFor(mood, i, flip));
  // too few skills for the mood: fewer, longer blocks rather than breaking it. Only when nothing fits at all does it mix.
  if (!skills.length && MOODS[mood]) {
    toast(
      'Nothing ' + MOODS[mood] + ' is open to this account yet, so this session mixes in other blocks.',
      '',
    );
    fill((i) => tiersFor('balanced', i));
  }
  const per = skills.length ? Math.max(20, Math.round(left / skills.length)) : 0;
  skills.forEach(({ k, m, want }, n) => {
    const mins = n === skills.length - 1 ? Math.max(20, left - per * (skills.length - 1)) : per; // the last block takes up the rounding
    blocks.push({
      kind: 'skill',
      k,
      mi: m.i,
      title: m.n,
      note: m.note,
      minutes: mins,
      int: m.int,
      want,
      xph: m.xph,
      est: m.est,
      target: Math.round((m.xph * mins) / 60),
      elapsed: 0,
      running: null,
      done: false,
    });
  });
  if (wild)
    blocks.push({
      kind: 'wild',
      title: wild.n,
      note: wild.d,
      minutes: 15,
      int: 'wild',
      elapsed: 0,
      running: null,
      done: false,
    });
  blocks.forEach((b) => {
    b.elapsed = 0;
    b.running = null;
    b.done = false;
  });
  const snap = {};
  if (state.hs) for (const k in state.hs.skills) snap[k] = state.hs.skills[k].xp;
  state.session = { t0: Date.now(), minutes, blocks, startSnap: snap, ended: null, gains: null };
  state.rotation = state.rotation.concat(blocks.filter((b) => b.kind === 'skill').map((b) => b.k)).slice(-6);
  save();
  cue = ['deal'];
  render();
}

function rerollBlock(i) {
  const b = state.session.blocks[i];
  if (b.kind !== 'skill') return;
  const others = state.session.blocks.filter((x) => x.kind === 'skill');
  const used = new Set(others.map((x) => x.k)),
    titles = new Set(others.map((x) => act(x.title)));
  // a block dealt before moods were strict has no want: take it from the mood now
  const ints = b.want || (MOODS[state.prefs.mood] ? tiersFor(state.prefs.mood, 0)[0] : [b.int]);
  const cs = pool(ints, titles).filter((k) => !used.has(k));
  if (!cs.length) {
    toast(
      'Nothing else ' +
        (ints.length === 1 ? (ints[0] === 'active' ? 'active' : INTENSITY[ints[0]]) + ' ' : '') +
        'to swap in.',
      '',
    );
    return;
  }
  const ms = cs.map((k) => pickFor(k, ints, titles));
  const k = wpick(
    cs,
    cs.map((k, j) => weightFor(k, ms[j], b.minutes, [])),
  );
  const m = ms[cs.indexOf(k)];
  Object.assign(b, {
    k,
    mi: m.i,
    title: m.n,
    note: m.note,
    int: m.int,
    want: ints,
    xph: m.xph,
    est: m.est,
    target: Math.round((m.xph * b.minutes) / 60),
    elapsed: 0,
    running: null,
    done: false,
  });
  save();
  cue = ['swap', i];
  render();
}

function blockElapsed(b) {
  return b.elapsed + (b.running ? Date.now() - b.running : 0);
}

function toggleBlock(i) {
  const b = state.session.blocks[i];
  if (b.running) {
    b.elapsed += Date.now() - b.running;
    b.running = null;
  } else {
    state.session.blocks.forEach((x, j) => {
      if (j !== i && x.running) {
        x.elapsed += Date.now() - x.running;
        x.running = null;
      }
    });
    b.running = Date.now();
  }
  save();
  render();
}

function doneBlock(i) {
  const b = state.session.blocks[i];
  if (b.running) {
    b.elapsed += Date.now() - b.running;
    b.running = null;
  }
  b.done = true;
  if (b.kind === 'reset') {
    state.resets[b.k] = Date.now();
  }
  save();
  render();
}

async function finishSession() {
  const ok = await ask(
    'Finish the session',
    'Log out or hop worlds first so the hiscores catch up, then finish. I will fetch your stats and tally the gains.',
    'Finish',
  );
  if (!ok) return;
  state.session.blocks.forEach((b) => {
    if (b.running) {
      b.elapsed += Date.now() - b.running;
      b.running = null;
    }
  });
  await refresh({ ws: false });
  const gains = {};
  let total = 0;
  if (state.hs)
    for (const k in state.hs.skills) {
      const g = state.hs.skills[k].xp - (state.session.startSnap[k] || 0);
      if (g > 0) {
        gains[k] = g;
        total += g;
      }
    }
  const lv = {};
  for (const k in gains) {
    const before = lvlFor(state.session.startSnap[k] || 0),
      after = stat(k).level;
    if (after > before) lv[k] = after - before;
  }
  state.session.ended = Date.now();
  state.session.gains = gains;
  state.session.total = total;
  state.session.levels = lv;
  state.history.unshift({
    t: Date.now(),
    minutes: state.session.minutes,
    elapsed: state.session.blocks.reduce((a, b) => a + b.elapsed, 0),
    gains,
    total,
    levels: lv,
    blocks: state.session.blocks.map((b) => ({ kind: b.kind, k: b.k, title: b.title, done: b.done })),
  });
  if (state.history.length > 400) state.history.length = 400;
  save();
  cue = ['tally'];
  render();
}

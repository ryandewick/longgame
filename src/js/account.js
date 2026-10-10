/* What the account can do: levels, requirements, which methods are open, their rates, and the hours left to 99.
   A method row is [level, name, xp/h, intensity, cost, requirements, note, extra]. `k` is always a skill key such as 'mining'. */

function skillList() {
  const ks = SKILLS.map((s) => s.k);
  if (state.hs)
    for (const k in state.hs.skills)
      if (!SKILL[k]) {
        SKILL[k] = { k, n: state.hs.skills[k].n || k, cat: 'support' };
        ks.push(k);
      }
  return ks;
}
const stat = (k) => (state.hs && state.hs.skills[k]) || { level: 1, xp: 0 };
const remain = (k) => Math.max(0, MAXXP - stat(k).xp);
let memo = {};
const once = (key, fn) => (key in memo ? memo[key] : (memo[key] = fn()));
const isIronman = () => state.prefs.account === 'iron';
const isPassive = (k) => !!(SKILL[k] && SKILL[k].passive); // trained by other skills (Hitpoints): never dealt, no hours of its own
const isDaily = (k) => !!(SKILL[k] && SKILL[k].daily); // trained by timed runs (Farming): time left is counted in days of runs

function combatLevel() {
  const l = (k) => stat(k).level;
  return Math.floor(
    0.25 * (l('defence') + l('hitpoints') + Math.floor(l('prayer') / 2)) +
      Math.max(
        0.325 * (l('attack') + l('strength')),
        0.325 * Math.floor(1.5 * l('ranged')),
        0.325 * Math.floor(1.5 * l('magic')),
      ),
  );
}

/* a method row is [level, name, xp/h, intensity, cost, requirements, note, extra].
   extra: who ('main' needs the Grand Exchange, 'iron' is an ironman-only route), run (a timed run), supply, tick (tick-perfect play),
   bands ([level, xp/h] steps), per (xp a run), every (minutes between runs) */
const extra = (m) => m[7] || {};

/* rates the wiki leaves out, worked out from the account's own levels.
   crab-melee: the Gemstone Crab has no defence, so a 4-tick weapon lands about 97% of 1,500 swings an hour at half the max hit,
   for 4 XP per damage cut to the crab's 87.5%. Gear is assumed: strength bonus from +40 at 30 Strength to +110 at 90, no prayer or potions. */

/* item and spell figures from the wiki's pages. RSTR: ranged strength. SPELLS: [level, base XP, max hit]; earth spells at their lower max. */
const RSTR = { steel: 3, mithril: 9, adamant: 17, ruby: 103, rosewood: 6 };
const SPELLS = {
  fire: [
    [13, 11.5, 8],
    [35, 22.5, 12],
    [59, 34.5, 16],
    [75, 42.5, 20],
    [95, 50.5, 24],
  ],
  earth: [
    [9, 9.5, 6],
    [29, 19.5, 11],
    [53, 31.5, 15],
    [70, 40, 19],
    [90, 48.2, 23],
  ],
};

/* 1,200 autocasts an hour (5-tick staff). A cast gives its base XP even on a splash, plus 2 XP per damage.
   weak: the target's elemental weakness, which adds that % to both damage and accuracy. */

function spellRate(l, el, weak, hit, mult, eff) {
  const s = SPELLS[el].filter((x) => x[0] <= l).pop();
  if (!s) return 0;
  const max = s[2] + Math.floor((s[2] * weak) / 100),
    h = Math.min(0.99, hit * (1 + weak / 100));
  return Math.round((1200 * (s[1] + h * max) * mult * eff) / 500) * 500;
}
const CALC = {
  /* Rapid style on the zero-defence crab (97% of shots land), 4 XP per damage cut to 87.5%. The wiki's progression:
     darts before 46 (2 ticks on rapid), an adamant crossbow with ruby bolts (e) from 46 (5 ticks, plus about 60 damage
     every ~20 shots from the bolt effect), a rosewood blowpipe with adamant darts from 65 (2 ticks). No potions or prayer. */
  'crab-ranged': (k, l) => {
    let rstr = RSTR.steel,
      ticks = 2,
      bonus = 0;
    if (l >= 65) rstr = RSTR.rosewood + RSTR.adamant;
    else if (l >= 46) {
      rstr = RSTR.ruby;
      ticks = 5;
      bonus = 3;
    } else if (l >= 20) rstr = RSTR.mithril;
    const max = Math.floor(0.5 + ((l + 8) * (rstr + 64)) / 640);
    return Math.round((((((max / 2) * 0.97 + bonus) * 3600) / (ticks * 0.6)) * 4 * 0.875) / 500) * 500;
  },
  'rock-magic': (k, l) => spellRate(l, 'earth', 20, 0.95, 1, 0.9),
  'frost-magic': (k, l) => spellRate(l, 'fire', 100, 0.95, 1, 0.9),
  'gem-magic': (k, l) =>
    Math.max(spellRate(l, 'fire', 0, 0.95, 0.875, 1), spellRate(l, 'earth', 0, 0.95, 0.875, 1)),
  'crab-melee': (k, l) => {
    const s = k === 'strength' ? l : stat('strength').level;
    const bonus = Math.max(40, Math.min(110, Math.round(40 + ((s - 30) * 7) / 6)));
    const max = Math.floor(0.5 + ((s + 8 + (k === 'strength' ? 3 : 0)) * (bonus + 64)) / 640);
    return Math.round((((1500 * max) / 2) * 4 * 0.875 * 0.97) / 500) * 500;
  },
};
const xphAt = (m, l, k) => {
  const c = extra(m).calc;
  if (c && CALC[c]) return CALC[c](k, l);
  const b = extra(m).bands;
  let x = m[2];
  if (b) for (const s of b) if (s[0] <= l) x = s[1];
  return x;
};
const perAt = (m, l) => {
  const x = extra(m);
  return x.per ? (m[2] > 0 ? (x.per * xphAt(m, l)) / m[2] : x.per) : 0;
};

function parseReq(r) {
  const o = { q: [], s: {}, d: [], c: 0 };
  if (!r) return o;
  r.split(';').forEach((p) => {
    const [t, v] = p.split(':');
    if (!v) return;
    if (t === 'q') o.q = v.split('|');
    else if (t === 'd') o.d = v.split('|');
    else if (t === 'c') o.c = +v;
    else if (t === 's')
      v.split(',').forEach((x) => {
        const m = x.trim().match(/^(\w+)\s+(\d+)$/);
        if (m) o.s[m[1]] = +m[2];
      });
  });
  return o;
}

function questDone(n) {
  return once('q:' + n, () => questDoneNow(n));
}

function questDoneNow(n) {
  if (state.manual.allQuests) return true;
  if (state.manual.quests[n]) return true;
  const q = state.ws && state.ws.quests;
  if (!q) return false;
  const norm = (x) => x.replace(/’/g, "'");
  const target = norm(n);
  for (const k in q) {
    if (norm(k) === target && q[k] === 2) return true;
  }
  const Q = QUESTS.find((x) => x.n === n);
  if (Q && Q.alias)
    for (const a of Q.alias) for (const k in q) if (norm(k) === norm(a) && q[k] === 2) return true;
  return false;
}

function diaryDone(spec) {
  // 'Ardougne Medium'
  if (state.manual.allDiaries) return true;
  if (state.manual.diaries[spec]) return true;
  const d = state.ws && state.ws.achievement_diaries;
  if (!d) return false;
  const i = spec.lastIndexOf(' ');
  const region = spec.slice(0, i),
    tier = spec.slice(i + 1);
  const r = d[region] || d[region.replace(' & ', ' and ')];
  return !!(r && r[tier] && r[tier].complete);
}

function reqState(r) {
  const o = parseReq(r);
  const miss = [];
  o.q.forEach((q) => {
    if (!questDone(q)) miss.push(q);
  });
  for (const k in o.s) if (stat(k).level < o.s[k]) miss.push(o.s[k] + ' ' + (SKILL[k] ? SKILL[k].n : k));
  o.d.forEach((d) => {
    if (!diaryDone(d)) miss.push(d + ' diary');
  });
  if (o.c && combatLevel() < o.c) miss.push(o.c + ' combat');
  return miss;
}

function methods(k) {
  return once('m:' + k, () => methodsNow(k));
}

function methodsNow(k) {
  const L = stat(k).level;
  return (METHODS[k] || [])
    .map((m, i) => {
      const x = extra(m);
      const miss = reqState(m[5]);
      if (x.who === 'main' && isIronman()) miss.push('the Grand Exchange');
      return {
        i,
        lv: m[0],
        n: m[1],
        xph: xphAt(m, L, k),
        int: m[3],
        cost: m[4],
        req: m[5],
        note: m[6],
        who: x.who || 'both',
        run: !!x.run,
        supply: !!x.supply,
        tick: !!x.tick,
        start: !!x.start,
        est: !!x.est,
        setup: !!x.setup,
        per: Math.round(perAt(m, L)),
        every: x.every || 0,
        miss,
        skill: k,
        ok: m[0] <= L && !miss.length,
      };
    })
    .filter((m) => m.who !== 'iron' || isIronman());
}
const cheapOnly = (ms) => {
  if (isIronman() || state.prefs.budget !== 'cheap') return ms;
  const c = ms.filter((m) => m.cost !== 'pricey');
  return c.length ? c : ms;
};

/* what a session block can be: something you can grind now, so never a timed run and never a passive skill */
const noTicks = (m) => state.prefs.ticks || !m.tick;

function pickable(k) {
  if (isPassive(k)) return [];
  let ms = methods(k).filter((m) => m.ok && m.xph > 0 && !m.run && noTicks(m));
  if (!ms.length)
    ms = methods(k)
      .filter((m) => m.ok && !m.run && noTicks(m))
      .slice(-1);
  return cheapOnly(ms);
}

/* the fastest thing the account can do in a skill, runs included for a runs skill: what the Skills and Methods views call best */
function topMethod(k) {
  if (isPassive(k)) return null;
  const ms = cheapOnly(methods(k).filter((m) => m.ok && m.xph > 0 && noTicks(m) && (isDaily(k) || !m.run)));
  return ms.sort((a, b) => b.xph - a.xph)[0] || bestMethod(k);
}

function bestMethod(k, mood) {
  const ms = pickable(k, mood);
  if (!ms.length) return null;
  mood = mood || state.prefs.mood;
  const score = (m) =>
    (isIronman() && m.supply ? 0.6 : 1) *
    m.xph *
    (mood === 'afk'
      ? m.int === 'afk'
        ? 2.2
        : m.int === 'semi'
          ? 1.4
          : 0.6
      : mood === 'active'
        ? m.int === 'active'
          ? 1.3
          : m.int === 'semi'
            ? 1
            : 0.7
        : m.int === 'afk'
          ? 1.25
          : m.int === 'semi'
            ? 1.1
            : 1);
  return ms.slice().sort((a, b) => score(b) - score(a))[0];
}

function rateFor(k) {
  const p = pace(k, 14);
  const m = bestMethod(k);
  if (m && m.xph > 0) return m.xph;
  if (p.perHour > 0) return p.perHour;
  return 40000;
}

function usableAt(k, m, l) {
  const x = extra(m);
  if (m[0] > l || (x.tick && !state.prefs.ticks)) return false;
  if (x.who === 'iron' ? !isIronman() : x.who === 'main' && isIronman()) return false;
  if (!isIronman() && state.prefs.budget === 'cheap' && m[4] === 'pricey') return false;
  const o = parseReq(m[5]);
  for (const q of o.q) if (!questDone(q)) return false;
  for (const s in o.s) {
    if ((s === k ? l : stat(s).level) < o.s[s]) return false;
  }
  for (const d of o.d) if (!diaryDone(d)) return false;
  return !(o.c && combatLevel() < o.c);
}
const FALLBACK = 40000; // stands in where the wiki gives no hourly rate; anything built on it is shown as rough

function rateAt(k, l) {
  let best = 0;
  (METHODS[k] || []).forEach((m) => {
    if (extra(m).run && !isDaily(k)) return;
    const x = xphAt(m, l, k);
    if (x > best && usableAt(k, m, l)) best = x;
  });
  return best;
}

function rough(k) {
  return once('r:' + k, () => roughNow(k));
}

function roughNow(k) {
  const s = stat(k);
  if (s.level >= 99 || isPassive(k)) return false;
  for (let l = s.level; l < 99; l++) if (!rateAt(k, l)) return true;
  return false;
}

/* xp a day from doing each available run once a day (less often if it takes longer than a day to regrow): the pace a runs skill really moves at */
function dayXpAt(k, l) {
  let x = 0;
  (METHODS[k] || []).forEach((m) => {
    if (extra(m).run && extra(m).per && usableAt(k, m, l))
      x += perAt(m, l) * Math.min(1, 1440 / (extra(m).every || 1440));
  });
  return x;
}

function daysLeft(k) {
  return once('d:' + k, () => daysLeftNow(k));
}

function daysLeftNow(k) {
  const s = stat(k);
  if (s.level >= 99 || !isDaily(k)) return 0;
  let d = 0;
  for (let l = s.level; l < 99; l++) {
    const x = dayXpAt(k, l);
    if (!x) return 0;
    d += (l === s.level ? XP[l + 1] - s.xp : XP[l + 1] - XP[l]) / x;
  }
  return d;
}

function hoursLeft(k) {
  return once('h:' + k, () => hoursLeftNow(k));
}

function hoursLeftNow(k) {
  const s = stat(k);
  if (s.level >= 99 || isPassive(k)) return 0;
  let h = 0;
  for (let l = s.level; l < 99; l++) {
    h += (l === s.level ? XP[l + 1] - s.xp : XP[l + 1] - XP[l]) / (rateAt(k, l) || FALLBACK);
  }
  return h;
}

function nextUnlock(k) {
  const L = stat(k).level;
  const ms = methods(k)
    .filter((m) => !m.ok && m.xph > 0 && noTicks(m) && !(isIronman() && m.who === 'main'))
    .sort((a, b) => a.lv - b.lv);
  return ms[0] || null;
}

function maxStats() {
  const ks = skillList();
  let xp = 0,
    levels = 0,
    hours = 0,
    maxed = 0;
  ks.forEach((k) => {
    const s = stat(k);
    xp += Math.min(s.xp, MAXXP);
    levels += 99 - Math.min(99, s.level);
    if (s.level >= 99) maxed++;
    else hours += hoursLeft(k);
  });
  return { pct: (xp / (ks.length * MAXXP)) * 100, xp, levels, hours, maxed, n: ks.length };
}

function pace(k, days) {
  // xp per day from snapshots
  if (!snaps.length) return { perDay: 0, perHour: 0, days: 0 };
  const cutoff = Date.now() - days * 86400000;
  const inWin = snaps.filter((s) => s.t >= cutoff);
  const first = inWin[0] || snaps[snaps.length - 1];
  const last = snaps[snaps.length - 1];
  const span = (last.t - first.t) / 86400000;
  if (span < 0.2) return { perDay: 0, perHour: 0, days: span };
  const g = k ? (last.skills[k] || 0) - (first.skills[k] || 0) : (last.total || 0) - (first.total || 0);
  return { perDay: g / span, perHour: 0, days: span };
}

function dailyGains(days) {
  const out = [];
  const byDay = {},
    first = {};
  snaps.forEach((s) => {
    const k = dayKey(s.t);
    if (!first[k]) first[k] = s;
    byDay[k] = s;
  });
  const keys = Object.keys(byDay).sort();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d.getTime());
    const idx = keys.indexOf(key);
    let gain = 0;
    if (idx > 0) {
      gain = (byDay[key].total || 0) - (byDay[keys[idx - 1]].total || 0);
    } else if (idx === 0) {
      gain = (byDay[key].total || 0) - (first[key].total || 0);
    } // first day on record: measure from its first snapshot
    out.push({
      key,
      gain: Math.max(0, gain),
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2),
    });
  }
  return out;
}

function streak() {
  const days = new Set();
  state.history.forEach((h) => {
    if (Object.values(h.gains || {}).some((v) => v > 0)) days.add(dayKey(h.t));
  });
  dailyGains(60).forEach((d) => {
    if (d.gain > 0) days.add(d.key);
  });
  let n = 0;
  const d = new Date();
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d.getTime()))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* every: minutes, 'utc' (resets at 00:00 UTC), 'weekly', or [[level, minutes], ...] keyed on the reset's skill */
function resetEvery(r) {
  if (!Array.isArray(r.every)) return r.every === 'daily' ? 'utc' : r.every;
  const L = stat(r.skill).level;
  let x = r.every[0][1];
  for (const s of r.every) if (s[0] <= L) x = s[1];
  return x;
}
const resetMine = (r) => !(r.who === 'main' && isIronman()) && !(r.who === 'iron' && !isIronman());
const span = (ms) =>
  ms < 3600000
    ? Math.ceil(ms / 60000) + ' min'
    : ms < 172800000
      ? Math.ceil(ms / 3600000) + ' h'
      : Math.ceil(ms / 86400000) + ' days';

function resetDue(r) {
  const last = state.resets[r.k] || 0;
  if (!last) return { due: true, text: 'never done' };
  const now = Date.now(),
    ev = resetEvery(r);
  if (ev === 'utc') {
    const d = new Date(),
      mid = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return last < mid
      ? { due: true, text: 'due, last ' + ago(last) }
      : { due: false, text: 'ready in ' + span(mid + 86400000 - now) };
  }
  const need = ev === 'weekly' ? 7 * 86400000 : ev * 60000;
  return now - last >= need
    ? { due: true, text: 'due, last ' + ago(last) }
    : { due: false, text: 'ready in ' + span(need - (now - last)) };
}

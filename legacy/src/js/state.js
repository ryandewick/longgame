/* The saved account (`state`) and the XP snapshots: loading, saving, and the browser-side snapshot store the website uses. */

let state = null,
  view = 'tonight',
  snaps = [],
  selected = null,
  saveTimer = null,
  toastTimer = null,
  busy = false;

function blank() {
  return {
    v: 1,
    name: '',
    hs: null,
    ws: null,
    wsError: null,
    manual: { quests: {}, diaries: {}, allQuests: false, allDiaries: false },
    prefs: {
      mood: 'balanced',
      minutes: 90,
      budget: 'any',
      account: null,
      ticks: false,
      exclude: {},
      dailies: true,
      wildcard: true,
      sort: 'hours',
    },
    session: null,
    resets: {},
    history: [],
    rotation: [],
  };
}

async function loadState() {
  if (SERVER) {
    try {
      const s = await api('/api/state');
      if (s && s.v) return s;
    } catch (e) {}
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return blank();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
  if (!SERVER) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }).catch(() => {});
  }, 400);
}

/* On the public site the XP snapshots live in this browser. Same rule as the local server: when nothing is new the trailing
   duplicate slides forward, so a gain stays on the day it was earned. */
const snapKey = (n) =>
  'longgame.snaps.' +
  String(n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');

function loadSnaps(n) {
  try {
    return JSON.parse(localStorage.getItem(snapKey(n))) || [];
  } catch (e) {
    return [];
  }
}

function storeSnaps(n, a) {
  if (a.length > 600) a = a.slice(-600);
  try {
    localStorage.setItem(snapKey(n), JSON.stringify(a));
  } catch (e) {}
  return a;
}

function pushSnap(n, skills, total) {
  const a = loadSnaps(n),
    same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (a.length > 1 && same(a[a.length - 1].skills, skills) && same(a[a.length - 2].skills, skills))
    a[a.length - 1].t = Date.now();
  else a.push({ t: Date.now(), skills, total });
  return storeSnaps(n, a);
}

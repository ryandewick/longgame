/* Motion. GSAP animates five moments and nothing else; a change of tab uses the browser view transition. */

/* GSAP animates five moments (the rack filling on load, a deal, a block going live, a swap, the tally) and nothing else.
   Every screen is complete without it: the markup is final before any tween starts, and reduced motion skips them all. */
let cue = null,
  lastLive = null;
const still = () => !window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function liveIndex() {
  const s = state && state.session;
  if (!s || s.ended) return -1;
  let i = s.blocks.findIndex((b) => b.running);
  if (i < 0) i = s.blocks.findIndex((b) => !b.done);
  return i;
}

function fillRack() {
  // every cape fills from empty to its level
  document.querySelectorAll('.stage .im').forEach((el, i) => {
    const to = el.style.getPropertyValue('--p');
    gsap.fromTo(
      el,
      { '--p': '0%' },
      { '--p': to, duration: 0.9, delay: 0.2 + i * 0.025, ease: 'power2.out' },
    );
  });
}

function goLive() {
  // the block's cape comes forward on the rail and drops into the panel
  if (document.querySelector('.c.now .im'))
    gsap.from('.c.now .im', { y: 0, scale: 1, duration: 0.45, ease: 'back.out(2)', clearProps: 'transform' });
  if (document.querySelector('.live .sw img'))
    gsap.from('.live .sw img', {
      yPercent: -115,
      duration: 0.5,
      ease: 'power3.out',
      clearProps: 'transform',
    });
  gsap.from('.live .say>*,.live .clk>*', {
    y: 8,
    autoAlpha: 0,
    duration: 0.3,
    stagger: 0.03,
    delay: 0.1,
    ease: 'power2.out',
    clearProps: 'all',
  });
}

function xpDrops() {
  // the tally, the way the game shows it: the cape fills to its new level and the XP floats up off it
  const s = state.session;
  if (!s || !s.gains) return;
  Object.keys(s.gains).forEach((k, n) => {
    const c = document.querySelector('.c[data-k="' + k + '"]');
    if (!c) return;
    const im = c.querySelector('.im');
    const from = pos(lvlFor(s.startSnap[k] || 0)) + '%',
      to = im.style.getPropertyValue('--p');
    if (from !== to)
      gsap.fromTo(
        im,
        { '--p': from },
        { '--p': to, duration: 1.2, delay: 0.2 + n * 0.08, ease: 'power2.out' },
      );
    const d = document.createElement('span');
    d.className = 'xpdrop rs w';
    d.textContent = '+' + fmt(s.gains[k]) + ' xp';
    c.appendChild(d);
    gsap.fromTo(
      d,
      { y: 30, autoAlpha: 0 },
      {
        y: -18,
        autoAlpha: 1,
        duration: 1.1,
        delay: 0.2 + n * 0.08,
        ease: 'power1.out',
        onComplete: () =>
          gsap.to(d, { autoAlpha: 0, duration: 0.5, delay: 1.2, onComplete: () => d.remove() }),
      },
    );
  });
  if (document.querySelector('.lvlup'))
    gsap.from('.lvlup', {
      y: -16,
      autoAlpha: 0,
      duration: 0.4,
      delay: 0.6,
      ease: 'back.out(1.6)',
      clearProps: 'all',
    });
}

/* a change of view: the page crossfades and the yellow line slides to the new tab (the browser's view transition, styled in head.html).
   Where the browser has none, the new view just rises in. Reduced motion gets a plain swap. */

function go(fn) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    fn();
    return;
  }
  if (document.startViewTransition) {
    // the browser skips a transition when the tab is hidden or another one starts; the page still updates, so that is not an error
    const transition = document.startViewTransition(fn);
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
    return;
  }
  fn();
  if (window.gsap)
    gsap.from('main', { autoAlpha: 0, y: 8, duration: 0.22, ease: 'power2.out', clearProps: 'all' });
}

function animate(kind, arg) {
  if (still()) return;
  if (kind === 'boot') fillRack();
  else if (kind === 'deal') {
    gsap.from('.q .qc', {
      y: 14,
      autoAlpha: 0,
      duration: 0.35,
      stagger: 0.06,
      ease: 'power2.out',
      clearProps: 'all',
    });
    goLive();
  } else if (kind === 'live') goLive();
  else if (kind === 'swap') {
    const el = document.querySelector('.qc[data-row="' + arg + '"]');
    if (el)
      gsap.from(el, {
        rotationX: -80,
        transformOrigin: '50% 0',
        duration: 0.4,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    if (arg === liveIndex()) goLive();
  } else if (kind === 'tally') {
    document.querySelectorAll('[data-count]').forEach((el, n) => {
      const to = +el.dataset.count,
        o = { v: 0 };
      gsap.to(o, {
        v: to,
        duration: 0.9,
        delay: n * 0.06,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = '+' + fmtK(o.v);
        },
      });
    });
    gsap.from('.last li', {
      x: -12,
      autoAlpha: 0,
      duration: 0.3,
      stagger: 0.06,
      ease: 'power2.out',
      clearProps: 'all',
    });
    xpDrops();
  }
}

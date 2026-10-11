/* Small pieces of interface shared by the views: the toast, the confirm sheet, chip groups and the attention mark. */

function toast(msg, val) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = (val ? '<b>' + esc(val) + '</b>' : '') + '<span>' + esc(msg) + '</span>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3600);
}

function ask(title, body, okLabel) {
  return new Promise((res) => {
    const back = document.activeElement;
    const bg = document.createElement('div');
    bg.className = 'mbg';
    bg.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ask-h"><h3 id="ask-h">' +
      esc(title) +
      '</h3><p>' +
      esc(body) +
      '</p><div class="acts"><button class="btn" data-m="no">Cancel</button><button class="btn pri" data-m="ok">' +
      esc(okLabel || 'Confirm') +
      '</button></div></div>';
    document.body.appendChild(bg);
    const done = (v) => {
      bg.remove();
      document.removeEventListener('keydown', key);
      if (back && back.focus && document.contains(back)) back.focus();
      res(v);
    };
    const key = (e) => {
      if (e.key === 'Escape') done(false);
    };
    bg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (b) done(b.dataset.m === 'ok');
      else if (e.target === bg) done(false);
    });
    document.addEventListener('keydown', key);
    bg.querySelector('[data-m=ok]').focus();
  });
}

const pos = (l) => (((Math.min(99, Math.max(1, l)) - 1) / 98) * 100).toFixed(2);
const chipSet = (key, opts, cur, label) =>
  '<div class="chips" role="group"' +
  (label ? ' aria-label="' + label + '"' : '') +
  '>' +
  opts
    .map(
      (x) =>
        '<button class="chip' +
        (cur === x[0] ? ' on' : '') +
        '" data-act="pref" data-k="' +
        key +
        '" data-v="' +
        x[0] +
        '" aria-pressed="' +
        (cur === x[0]) +
        '">' +
        x[1] +
        '</button>',
    )
    .join('') +
  '</div>';

/* how much attention a block takes: hollow, half, filled. Never a colour, because colour belongs to the capes. */
const paceTag = (t) => '<span class="pace p-' + t + '"><i></i>' + INTENSITY[t] + '</span>';
const long = (h) => hrs(h).replace(/ h$/, ' hours');

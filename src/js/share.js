/* Share my rack: draws the account's rack on a canvas as a 1200 by 630 picture to download, copy or share. */

/* Draws the account's rack on a 1200 by 630 canvas (the size link previews use) so a player can post it. Same rules as the page:
   lowest level first, each cape greyed and then coloured up to its level, the max cape at the end. */
const loadImg = (src) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('image'));
    i.src = src;
  });

function greyed(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const o = c.getContext('2d');
  o.drawImage(img, 0, 0, w, h);
  o.globalCompositeOperation = 'saturation';
  o.fillStyle = '#808080';
  o.fillRect(0, 0, w, h);
  o.globalCompositeOperation = 'multiply';
  o.fillStyle = '#5a5a5a';
  o.fillRect(0, 0, w, h);
  o.globalCompositeOperation = 'destination-in';
  o.drawImage(img, 0, 0, w, h);
  return c;
}

async function rackImage() {
  const W = 1200,
    H = 630,
    c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const ks = skillList()
    .slice()
    .sort((a, b) => stat(a).level - stat(b).level || stat(a).xp - stat(b).xp);
  const m = maxStats();
  if (document.fonts && document.fonts.load)
    await Promise.all(
      [
        '16px RS',
        '64px RSB',
        '800 40px Figtree',
        '700 26px Figtree',
        '500 21px Figtree',
        '800 40px Poppins',
      ].map((f) => document.fonts.load(f, 'long9ame 0123456789/').catch(() => {})),
    );
  const imgs = await Promise.all(
    ks.map((k) => loadImg(capeImg(k, stat(k).level >= 99))).concat(loadImg(ASSETS + 'capes-md/max.webp')),
  );
  const hard = (t, px, py, col, d) => {
    x.fillStyle = '#000';
    x.fillText(t, px + d, py + d);
    x.fillStyle = col;
    x.fillText(t, px, py);
  }; // the game's hard text shadow
  const hang = (img, px, py, w, h, p) => {
    x.drawImage(greyed(img, w, h), px, py);
    if (p > 0)
      x.drawImage(
        img,
        0,
        img.naturalHeight * (1 - p),
        img.naturalWidth,
        img.naturalHeight * p,
        px,
        py + h * (1 - p),
        w,
        h * p,
      );
  };
  // ground
  x.fillStyle = '#100d0b';
  x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, -140, 0, W / 2, -140, 920);
  g.addColorStop(0, '#3a2a1f');
  g.addColorStop(0.5, '#1b1411');
  g.addColorStop(1, '#100d0b');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  // the mark and the wordmark
  x.fillStyle = '#ffff00';
  x.beginPath();
  if (x.roundRect) x.roundRect(48, 40, 56, 56, 12);
  else x.rect(48, 40, 56, 56);
  x.fill();
  x.save();
  x.translate(53.6, 45.6);
  x.scale(0.7, 0.7);
  x.lineWidth = 9.5;
  x.strokeStyle = '#7d7a0a';
  x.beginPath();
  x.arc(32, 26, 14, 0, Math.PI * 2);
  x.stroke();
  x.stroke(new Path2D('M46 26V37c0 9.5-6 15-15 15h-5'));
  const pr = Math.max(0, Math.min(1, m.pct / 100));
  if (pr > 0.004) {
    x.strokeStyle = '#16120f';
    x.beginPath();
    x.arc(32, 26, 14, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2);
    x.stroke();
  }
  x.restore();
  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  x.font = '800 40px Poppins, Figtree, sans-serif';
  let wx = 120;
  for (const ch of 'lon9 9ame') {
    if (ch === ' ') {
      wx += 11;
      continue;
    }
    const nine = ch === '9';
    x.fillStyle = nine ? '#ffff00' : '#f0e2c4';
    x.fillText(ch, wx, 82 + (nine ? 8.6 : 0));
    wx += x.measureText(ch).width - 1.8;
  }
  // whose rack it is
  x.textAlign = 'right';
  x.font = '700 26px Figtree, sans-serif';
  x.fillStyle = '#fff';
  x.fillText(state.name, W - 48, 68);
  x.font = '500 19px Figtree, sans-serif';
  x.fillStyle = '#b9ab92';
  x.fillText(
    (isIronman() ? 'Ironman, total level ' : 'Total level ') + fmt(state.hs.total.level),
    W - 48,
    96,
  );
  // the count
  x.textAlign = 'left';
  x.font = '64px RSB, RS, sans-serif';
  const head = m.maxed + '/' + m.n;
  hard(head, 48, 206, '#ffff00', 3);
  const hw = x.measureText(head).width;
  x.font = '800 38px Figtree, sans-serif';
  x.fillStyle = '#fff';
  x.fillText('capes', 48 + hw + 16, 204);
  x.font = '500 21px Figtree, sans-serif';
  x.fillStyle = '#b9ab92';
  x.fillText(
    m.maxed === m.n
      ? 'Maxed. Every cape is on the rail.'
      : fmt(m.levels) + ' levels to go, about ' + long(m.hours) + ' at the best methods',
    48,
    246,
  );
  // the rail
  const ry = 296,
    lg = x.createLinearGradient(0, ry, 0, ry + 8);
  lg.addColorStop(0, '#d9b56a');
  lg.addColorStop(0.45, '#b08a45');
  lg.addColorStop(1, '#6f5425');
  x.fillStyle = 'rgba(0,0,0,.6)';
  x.fillRect(24, ry + 2, W - 48, 8);
  x.fillStyle = lg;
  x.fillRect(24, ry, W - 48, 8);
  // the capes
  const cw = 92,
    ch = Math.round((cw * 622) / 320),
    x0 = 44,
    pitch = (956 - cw) / Math.max(1, ks.length - 1),
    top = ry - 7;
  ks.forEach((k, i) => {
    const px = Math.round(x0 + i * pitch),
      lvl = Math.min(99, stat(k).level);
    hang(imgs[i], px, top, cw, ch, (lvl - 1) / 98);
  });
  x.font = '16px RS, sans-serif';
  x.textAlign = 'center';
  ks.forEach((k, i) =>
    hard(String(stat(k).level), Math.round(x0 + i * pitch) + cw / 2, top + ch + 32, '#ffff00', 1),
  );
  const mw = 96,
    mh = Math.round((mw * 620) / 320),
    mxp = W - 48 - mw;
  hang(imgs[imgs.length - 1], mxp, top, mw, mh, pr);
  hard('Max cape', mxp + mw / 2, top + ch + 32, '#fff', 1);
  // where it came from
  x.textAlign = 'left';
  x.font = '600 19px Figtree, sans-serif';
  const site = CONFIG.url ? CONFIG.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
  x.fillStyle = '#f0e2c4';
  x.fillText(site || 'Long Game', 48, H - 42);
  x.fillStyle = '#9a8d78';
  x.fillText('Free OSRS maxing planner', 48 + x.measureText(site || 'Long Game').width + 18, H - 42);
  x.textAlign = 'right';
  x.font = '500 16px Figtree, sans-serif';
  x.fillText('A fan project. Not affiliated with Jagex.', W - 48, H - 42);
  return c;
}

async function shareRack(btn) {
  if (btn) {
    btn.disabled = true;
  }
  let blob = null;
  try {
    const c = await rackImage();
    blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  } catch (e) {}
  if (btn) btn.disabled = false;
  if (!blob) {
    toast('Could not draw the picture here.', '');
    return;
  }
  const url = URL.createObjectURL(blob),
    fname = 'longgame-' + state.name.replace(/[^\w-]+/g, '_') + '.png',
    file = new File([blob], fname, { type: 'image/png' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] })),
    canCopy = !!(navigator.clipboard && window.ClipboardItem);
  const back = document.activeElement,
    bg = document.createElement('div');
  bg.className = 'mbg';
  bg.innerHTML =
    '<div class="modal share" role="dialog" aria-modal="true" aria-labelledby="sh-h"><h3 id="sh-h">Your rack</h3><img src="' +
    url +
    '" width="1200" height="630" alt="' +
    esc(state.name) +
    '’s skillcapes on the rail, ' +
    maxStats().maxed +
    ' of ' +
    maxStats().n +
    ' at 99">' +
    '<div class="acts"><button class="btn" data-m="close">Close</button>' +
    (canCopy ? '<button class="btn" data-m="copy">Copy image</button>' : '') +
    (canShare ? '<button class="btn" data-m="send">Share</button>' : '') +
    '<button class="btn pri" data-m="save">Download</button></div></div>';
  document.body.appendChild(bg);
  const close = () => {
    bg.remove();
    document.removeEventListener('keydown', key);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (back && back.focus && document.contains(back)) back.focus();
  };
  const key = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', key);
  bg.querySelector('[data-m=save]').focus();
  bg.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) {
      if (e.target === bg) close();
      return;
    }
    if (b.dataset.m === 'close') close();
    else if (b.dataset.m === 'save') {
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (b.dataset.m === 'copy') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Copied. Paste it wherever you like.', '');
      } catch (err) {
        toast('Could not copy it. Download it instead.', '');
      }
    } else if (b.dataset.m === 'send') {
      try {
        await navigator.share({ files: [file], title: 'My Long Game rack' });
      } catch (err) {}
    }
  });
}

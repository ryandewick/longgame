/* Two forms: importing an exported save, and suggesting a missing method. */

/* load a file made by Export: the account, its sessions and its XP history */
function importFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    let d = null;
    try {
      d = JSON.parse(await f.text());
    } catch (e) {}
    if (!d || !d.state || d.state.v !== 1 || !d.state.prefs || typeof d.state.name !== 'string') {
      toast('That file is not a Long Game export.', '');
      return;
    }
    if (
      !(await ask(
        'Import this file',
        'This replaces what is saved here with ' + d.state.name + ' from the file.',
        'Import',
      ))
    )
      return;
    state = Object.assign(blank(), d.state);
    snaps = Array.isArray(d.snaps) ? d.snaps : [];
    if (!SERVER) snaps = storeSnaps(state.name, snaps);
    save();
    view = 'tonight';
    cue = ['boot'];
    render();
    toast('Imported ' + state.name + '.', '');
  };
  inp.click();
}

/* a player's suggestion for a missing method. It goes to the relay, which files it for review; nothing is added to the data unchecked. */
function suggestForm(k) {
  const back = document.activeElement;
  const bg = document.createElement('div');
  bg.className = 'mbg';
  const opt = (v, t, cur) =>
    '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + t + '</option>';
  bg.innerHTML =
    '<form class="modal wide" role="dialog" aria-modal="true" aria-labelledby="sg-h"><h3 id="sg-h">Suggest a method</h3><p>Know a good method that is missing? Send it and it will be checked against the wiki before it is added.</p>' +
    '<div class="grid2"><label class="field"><span class="lab">Skill</span><select class="in" name="skill">' +
    skillList()
      .filter((x) => !isPassive(x))
      .map((x) => opt(x, esc(SKILL[x].n), k))
      .join('') +
    '</select></label>' +
    '<label class="field"><span class="lab">Level needed</span><input class="in" name="level" type="number" min="1" max="99" required></label></div>' +
    '<label class="field"><span class="lab">Method</span><input class="in" name="name" maxlength="80" required placeholder="What you do, in a few words"></label>' +
    '<div class="grid2"><label class="field"><span class="lab">XP an hour, if you know it</span><input class="in" name="xph" type="number" min="0" max="2000000" step="500"></label>' +
    '<label class="field"><span class="lab">Attention</span><select class="in" name="intensity">' +
    opt('afk', 'AFK') +
    opt('semi', 'Semi-AFK') +
    opt('active', 'Active') +
    '</select></label></div>' +
    '<label class="field"><span class="lab">Works for</span><select class="in" name="who">' +
    opt('both', 'Mains and ironmen') +
    opt('main', 'Mains only') +
    opt('iron', 'Ironmen only') +
    '</select></label>' +
    '<label class="field"><span class="lab">Wiki page that backs it up</span><input class="in" name="wiki" type="url" required pattern="https://oldschool\\.runescape\\.wiki/.+" placeholder="https://oldschool.runescape.wiki/w/..."><span class="help">A link to the method or training guide on the Old School RuneScape Wiki.</span></label>' +
    '<label class="field"><span class="lab">Anything else</span><textarea class="in" name="notes" maxlength="600" rows="3" placeholder="Quests, gear, where it is, why it is good"></textarea></label>' +
    '<input class="vh" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<div class="acts"><button class="btn" type="button" data-m="no">Cancel</button><button class="btn pri" type="submit">Send suggestion</button></div></form>';
  document.body.appendChild(bg);
  const form = bg.querySelector('form');
  const close = () => {
    bg.remove();
    document.removeEventListener('keydown', key);
    if (back && back.focus) back.focus();
  };
  const key = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', key);
  bg.addEventListener('click', (e) => {
    if (e.target === bg || e.target.closest('[data-m=no]')) close();
  });
  form.elements.name.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('[type=submit]');
    b.disabled = true;
    b.textContent = 'Sending…';
    try {
      await api(API + '/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      close();
      toast('Sent. Thank you, it will be checked against the wiki.', '');
    } catch (err) {
      b.disabled = false;
      b.textContent = 'Send suggestion';
      toast(err.message || 'Could not send it.', '');
    }
  });
}

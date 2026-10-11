/* Settings: account, session preferences, skills to leave out, and export or import. */

function settingsHTML() {
  const p = state.prefs;
  let h =
    '<div class="sec"><h2>Settings</h2></div><div class="form"><div class="field"><label class="lab" for="rsn">Account</label><div class="inline"><input class="in" id="rsn" value="' +
    esc(state.name) +
    '" autocomplete="off" spellcheck="false"><button class="btn" data-act="setname">Change name</button></div></div>';
  h +=
    '<div class="field"><span class="lab">Account type</span>' +
    chipSet(
      'account',
      [
        ['main', 'Main'],
        ['iron', 'Ironman'],
      ],
      p.account || 'main',
      'Account type',
    ) +
    '<span class="help">Ironman drops every method that needs the Grand Exchange and uses the wiki’s ironman routes instead. It is read from the hiscores when the name loads. Change it here if that is wrong.</span></div>';
  if (!isIronman())
    h +=
      '<div class="field"><span class="lab">Budget</span>' +
      chipSet(
        'budget',
        [
          ['any', 'Spend what it takes'],
          ['cheap', 'Cheap methods only'],
        ],
        p.budget,
        'Budget',
      ) +
      '<span class="help">Cheap hides the routes marked pricey.</span></div>';
  h +=
    '<div class="field"><span class="lab">Sessions</span><div class="chips"><button class="chip' +
    (p.dailies ? ' on' : '') +
    '" data-act="prefbool" data-k="dailies" aria-pressed="' +
    !!p.dailies +
    '">Slot in due resets</button><button class="chip' +
    (p.wildcard ? ' on' : '') +
    '" data-act="prefbool" data-k="wildcard" aria-pressed="' +
    !!p.wildcard +
    '">One wildcard per session</button><button class="chip' +
    (p.ticks ? ' on' : '') +
    '" data-act="prefbool" data-k="ticks" aria-pressed="' +
    !!p.ticks +
    '">Tick-perfect methods</button></div><span class="help">The wildcard only appears in sessions of 90 minutes or more. Tick-perfect methods (3-tick fishing, 1-tick karambwans and the like) are left out of plans and estimates unless you turn them on.</span></div>';
  h +=
    '<div class="field"><span class="lab">Skills to leave out</span><div class="chips">' +
    skillList()
      .filter((k) => !isPassive(k))
      .map(
        (k) =>
          '<button class="chip' +
          (p.exclude[k] ? ' on' : '') +
          '" data-act="excl" data-k="' +
          k +
          '" aria-pressed="' +
          !!p.exclude[k] +
          '">' +
          icon(k) +
          esc(SKILL[k].n) +
          '</button>',
      )
      .join('') +
    '</div><span class="help">Click to drop a skill from the session builder. It still shows on the Skills view.</span></div>';
  h +=
    '<div class="field"><span class="lab">Data</span><span class="help">' +
    (SERVER
      ? 'Everything is saved to the data folder next to longgame.py. Copy that folder to back it up, or export a file you can load on the website.'
      : 'Saved in this browser only. Clearing your site data removes it, so export a copy if it matters to you.') +
    '</span><div class="inline"><button class="btn" data-act="export">Export my data</button>' +
    (SERVER ? '' : '<button class="btn" data-act="import">Import a file</button>') +
    '<button class="btn danger" data-act="forget">Forget this account</button></div></div></div>';
  return h;
}

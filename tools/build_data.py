#!/usr/bin/env python3
"""Build data.js from the sources in datasrc/.

    python tools/build_data.py            build data.js and restitch longgame.html
    python tools/build_data.py --check    validate the sources only

Sources (all taken from the OSRS Wiki; each method carries the page it came from in `src`):
    datasrc/methods/<skill>.json   training methods, one file per skill
    datasrc/quests_set.json        fixed quest XP, parsed from "Quest experience rewards"
    datasrc/quests_lamps.json      skill-choice rewards, parsed from Module:SkillChoice
    datasrc/resets.json            timed runs and daily resets
    datasrc/wikisync_quests.json   quest names as WikiSync spells them, for checking requirements

data.js is generated. Edit the sources and rebuild; do not edit data.js by hand.
"""
import datetime
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'datasrc')

SKILLS = [
    ('attack', 'Attack', 'combat'), ('defence', 'Defence', 'combat'), ('strength', 'Strength', 'combat'),
    ('hitpoints', 'Hitpoints', 'combat'), ('ranged', 'Ranged', 'combat'), ('prayer', 'Prayer', 'combat'),
    ('magic', 'Magic', 'combat'), ('cooking', 'Cooking', 'artisan'), ('woodcutting', 'Woodcutting', 'gather'),
    ('fletching', 'Fletching', 'artisan'), ('fishing', 'Fishing', 'gather'), ('firemaking', 'Firemaking', 'artisan'),
    ('crafting', 'Crafting', 'artisan'), ('smithing', 'Smithing', 'artisan'), ('mining', 'Mining', 'gather'),
    ('herblore', 'Herblore', 'artisan'), ('agility', 'Agility', 'support'), ('thieving', 'Thieving', 'support'),
    ('slayer', 'Slayer', 'support'), ('farming', 'Farming', 'gather'), ('runecraft', 'Runecraft', 'artisan'),
    ('hunter', 'Hunter', 'gather'), ('construction', 'Construction', 'artisan'), ('sailing', 'Sailing', 'support'),
]
KEYS = [s[0] for s in SKILLS]
PASSIVE = {'hitpoints'}   # trained by combat; never dealt and no methods of its own
DAILY = {'farming'}       # trained by timed runs; time left is counted in days of runs
REGIONS = ['Ardougne', 'Desert', 'Falador', 'Fremennik', 'Kandarin', 'Karamja', 'Kourend & Kebos',
           'Lumbridge & Draynor', 'Morytania', 'Varrock', 'Western Provinces', 'Wilderness']
TIERS = ['Easy', 'Medium', 'Hard', 'Elite']

# The wiki titles the Recipe for Disaster subquests differently from WikiSync.
RENAME = {
    'Recipe for Disaster/Freeing King Awowogei': 'Recipe for Disaster - King Awowogei',
    'Recipe for Disaster/Freeing the Mountain Dwarf': 'Recipe for Disaster - Mountain Dwarf',
    'Recipe for Disaster/Freeing the Goblin generals': 'Recipe for Disaster - Wartface & Bentnoze',
    'Recipe for Disaster/Freeing Pirate Pete': 'Recipe for Disaster - Pirate Pete',
    'Recipe for Disaster/Freeing Skrach Uglogwee': 'Recipe for Disaster - Skrach Uglogwee',
    'Recipe for Disaster/Freeing the Lumbridge Guide': 'Recipe for Disaster - Lumbridge Guide',
    'Recipe for Disaster/Freeing Sir Amik Varze': 'Recipe for Disaster - Sir Amik Varze',
    'Recipe for Disaster/Freeing Evil Dave': 'Recipe for Disaster - Evil Dave',
    'Knight Waves': 'Knight Waves Training Grounds',
    'Natural history quiz': 'Natural history quiz',
}

problems, warnings = [], []


def load(name, default=None):
    path = os.path.join(SRC, name)
    if not os.path.exists(path):
        if default is not None:
            return default
        problems.append('missing source: datasrc/%s' % name)
        return {}
    with io.open(path, encoding='utf-8') as f:
        return json.load(f)


def norm(s):
    return s.replace('’', "'").strip()


def check_req(req, where, known_quests):
    """Requirements are 'q:A|B;s:skill 50,skill 60;d:Region Tier;c:70'."""
    for part in [p for p in (req or '').split(';') if p]:
        if ':' not in part:
            problems.append('%s: bad requirement part %r' % (where, part))
            continue
        t, v = part.split(':', 1)
        if t == 'q':
            for q in v.split('|'):
                if known_quests and norm(q) not in known_quests:
                    warnings.append('%s: quest %r is not a name WikiSync reports, so it can only be ticked by hand' % (where, q))
        elif t == 's':
            for x in v.split(','):
                m = re.match(r'^(\w+)\s+(\d+)$', x.strip())
                if not m or m.group(1) not in KEYS or not 1 <= int(m.group(2)) <= 99:
                    problems.append('%s: bad skill requirement %r' % (where, x))
        elif t == 'd':
            for d in v.split('|'):
                region, _, tier = d.rpartition(' ')
                if region not in REGIONS or tier not in TIERS:
                    problems.append('%s: bad diary requirement %r' % (where, d))
        elif t == 'c':
            if not v.isdigit() or not 3 <= int(v) <= 126:
                problems.append('%s: bad combat requirement %r' % (where, v))
        else:
            problems.append('%s: unknown requirement type %r' % (where, t))


def build_methods(known_quests):
    out = {}
    for key in KEYS:
        if key in PASSIVE:
            continue
        data = load('methods/%s.json' % key)
        rows = []
        for m in data.get('methods', []):
            where = '%s / %s' % (key, m.get('name'))
            lv, xph = m.get('lv'), m.get('xph', 0)
            if not isinstance(lv, int) or not 1 <= lv <= 99:
                problems.append('%s: level %r' % (where, lv))
                continue
            if m.get('int') not in ('afk', 'semi', 'active'):
                problems.append('%s: intensity %r' % (where, m.get('int')))
            if m.get('cost') not in ('profit', 'free', 'cheap', 'pricey'):
                problems.append('%s: cost %r' % (where, m.get('cost')))
            if m.get('who') not in ('both', 'main', 'iron'):
                problems.append('%s: who %r' % (where, m.get('who')))
            # a run's rate is xp per hour of time spent on the run, which is legitimately in the millions
            if not isinstance(xph, (int, float)) or xph < 0 or xph > (20000000 if m.get('run') else 2000000):
                problems.append('%s: xp/h %r' % (where, xph))
            if not m.get('src'):
                problems.append('%s: no source page' % where)
            if len(m.get('name', '')) > 48:
                warnings.append('%s: name is %d characters' % (where, len(m['name'])))
            m['req'] = (m.get('req') or '').replace('Vale Totems (miniquest)', 'Vale Totems')  # WikiSync's name for it
            check_req(m.get('req', ''), where, known_quests)
            extra = {}
            if m.get('who') in ('main', 'iron'):
                extra['who'] = m['who']
            if m.get('run'):
                extra['run'] = 1
                if m.get('per'):
                    extra['per'] = int(m['per'])
                if m.get('every'):
                    extra['every'] = int(m['every'])
                if not (m.get('per') and m.get('every')):
                    warnings.append('%s: a run without xp per run or minutes between runs' % where)
            if m.get('supply'):
                extra['supply'] = 1
            # tick-perfect methods are only offered when the player asks for them
            if re.search(r'\d(\.\d)?-tick\)', m.get('name', '')) or m.get('note', '').lower().startswith('tick-perfect'):
                extra['tick'] = 1
            # starter entries (quest skips, the museum quiz) are advice for the first levels, never a block to deal
            if lv == 1 and re.search(r"quest|quiz|Daddy's Home", m.get('name', ''), re.I):
                extra['start'] = 1
            # a rate the app works out from the account's own levels where the wiki gives none
            if m.get('calc'):
                if m['calc'] not in ('crab-melee', 'crab-ranged', 'rock-magic', 'frost-magic', 'gem-magic'):
                    problems.append('%s: unknown calc %r' % (where, m['calc']))
                extra['calc'] = m['calc']
            if m.get('est'):
                extra['est'] = 1
            # per-trip setup (a fee, potions, a quest list): AFK blocks prefer methods without it
            if m.get('setup'):
                extra['setup'] = 1
            bands = m.get('bands')
            if bands:
                if bands[0][0] != lv or any(b[0] <= a[0] for a, b in zip(bands, bands[1:])):
                    problems.append('%s: bands must start at the method level and ascend: %r' % (where, bands))
                if len(bands) > 1:
                    extra['bands'] = [[int(a), int(b)] for a, b in bands]
                xph = bands[0][1]
            note = re.sub(r'\s+', ' ', m.get('note', '')).strip()
            row = [lv, m['name'].strip(), int(xph), m['int'], m['cost'], m.get('req', '') or '', note]
            if extra:
                row.append(extra)
            rows.append((row, m.get('src', '')))
        rows.sort(key=lambda r: (r[0][0], -max([r[0][2]] + [b[1] for b in (r[0][7].get('bands', []) if len(r[0]) > 7 else [])])))
        out[key] = rows
        # Coverage: at every level each account type should have something with a rate, ignoring quest gates.
        for who in ('main', 'iron'):
            gaps = []
            for level in range(1, 99):
                ok = False
                for row, _ in rows:
                    x = row[7] if len(row) > 7 else {}
                    if row[0] > level or x.get('who', who) != who:
                        continue
                    rate = row[2]
                    for b in x.get('bands', []):
                        if b[0] <= level:
                            rate = b[1]
                    if rate > 0 or x.get('calc'):
                        ok = True
                        break
                if not ok:
                    gaps.append(level)
            if gaps:
                warnings.append('%s: no rated method for %s at levels %d to %d (%d levels)' % (key, who, gaps[0], gaps[-1], len(gaps)))
    return out


NUM = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']


def lamp_text(q):
    parts = [p.strip() for p in q['rewards'].split(',')]
    xp, count = int(parts[0]), int(parts[1])
    name = q['name'].replace("\\'", "'")
    restr = q['restrictions'].strip()
    if name == 'Monkey Madness I':
        return name, '35,000 xp each in a chosen pair of Attack, Strength, Defence and Hitpoints, and 20,000 each in the other pair.', 110000
    text = ('A %s xp lamp' % format(xp, ',')) if count == 1 else ('%s %s xp lamps' % (NUM[count], format(xp, ',')))
    if restr.isdigit():
        text += ' for any skill at level %s or above.' % restr
    elif restr.strip("'") == 'None':
        text += ' for any skill.'
    else:
        skills = re.sub(r'<br\s*/?>', ' ', restr.strip("'")).split()
        text += ' for ' + ', '.join(skills[:-1]) + ' or ' + skills[-1] + '.'
    if q.get('notes') and 'at least level' in q['notes']:
        text += ' ' + q['notes'].strip("'") + '.'
    return name, text, xp * count


def build_quests(known_quests):
    fixed = load('quests_set.json')
    lamps = load('quests_lamps.json', [])
    quests = {}
    for name, xp in fixed.get('xp', {}).items():
        n = RENAME.get(name, name)
        q = quests.setdefault(n, {'n': n, 'xp': {}})
        for k, v in xp.items():
            if k not in KEYS:
                problems.append('quest %s: unknown skill %r' % (name, k))
            q['xp'][k] = int(round(v))
        need = fixed.get('need', {}).get(name)
        if need:
            q['need'] = dict(need)
        if name in fixed.get('mini', []):
            q['mini'] = 1
    for entry in lamps:
        name, text, total = lamp_text(entry)
        q = quests.setdefault(name, {'n': name, 'xp': {}})
        q['lamps'], q['lampXp'] = text, total
        for skill, level in re.findall(r"SCP\('(\w+)',\s*'(\d+)'\)", entry.get('requirements') or ''):
            if skill.lower() in KEYS:
                q.setdefault('need', {})[skill.lower()] = max(int(level), q.get('need', {}).get(skill.lower(), 0))
    out = sorted(quests.values(), key=lambda q: q['n'])
    if known_quests:
        for q in out:
            if norm(q['n']) not in known_quests and not q.get('mini'):
                warnings.append('quest %r is not a name WikiSync reports, so it can only be ticked by hand' % q['n'])
    return out


def build_resets(known_quests):
    out = []
    for r in load('resets.json', []):
        where = 'reset %s' % r.get('k')
        ev = r.get('every')
        ok = ev in ('utc', 'weekly') or (isinstance(ev, int) and ev > 0) or (
            isinstance(ev, list) and ev and all(isinstance(b, list) and len(b) == 2 for b in ev))
        if not ok:
            problems.append('%s: every %r' % (where, ev))
        if isinstance(ev, list) and r.get('skill') not in KEYS:
            problems.append('%s: a cadence by level needs a skill' % where)
        check_req(r.get('req', ''), where, known_quests)
        row = {'k': r['k'], 'n': r['n'], 'every': ev, 'skill': r.get('skill', ''), 'req': r.get('req', ''), 'note': r['note']}
        if r.get('who') in ('main', 'iron'):
            row['who'] = r['who']
        out.append(row)
    return out


def js(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def main():
    known = {norm(n) for n in load('wikisync_quests.json', [])}
    methods = build_methods(known)
    quests = build_quests(known)
    resets = build_resets(known)

    for w in warnings:
        print('warning:', w)
    for p in problems:
        print('PROBLEM:', p)
    count = sum(len(v) for v in methods.values())
    print('%d methods in %d skills, %d quests, %d resets, %d warnings, %d problems'
          % (count, len(methods), len(quests), len(resets), len(warnings), len(problems)))
    if problems:
        sys.exit(1)
    if '--check' in sys.argv:
        return

    lines = ['/* ---------- Long Game data ---------- */',
             '/* GENERATED by tools/build_data.py on %s from datasrc/. Do not edit by hand: change the sources and rebuild.' % datetime.date.today().isoformat(),
             '   Levels, rates and requirements are taken from the OSRS Wiki; each method names its page in datasrc. */',
             '/* Skills in hiscores order. passive: trained by combat, never dealt. daily: trained by timed runs. */',
             'const SKILLS=[']
    for k, n, cat in SKILLS:
        extra = (',passive:1' if k in PASSIVE else '') + (',daily:1' if k in DAILY else '')
        lines.append("{k:'%s',n:'%s',cat:'%s'%s}," % (k, n, cat, extra))
    lines[-1] = lines[-1].rstrip(',')
    lines += ['];', '',
              '/* Methods: [minLevel, name, xp/h at that level, intensity afk|semi|active, cost profit|free|cheap|pricey, requirements, note, extra]',
              "   requirements: 'q:Quest|Other quest;s:skill level,skill level;d:Region Tier;c:combat level' (empty string = none)",
              "   extra (optional): who 'main' (needs the Grand Exchange) or 'iron' (ironman route), run (a timed run), per (xp a run),",
              '   every (minutes between runs), supply (an ironman needs banked supplies), tick (needs tick-perfect play), start (quest-skip advice, never dealt),',
              '   calc (rate worked out in app.js from the account\'s levels), est (that rate is an estimate), setup (per-trip setup),',
              '   bands ([level, xp/h] steps as the rate rises) */',
              'const METHODS={']
    for key in KEYS:
        if key not in methods:
            continue
        lines.append('%s:[' % key)
        rows = methods[key]
        for i, (row, _src) in enumerate(rows):
            lines.append(js(row) + (',' if i < len(rows) - 1 else ''))
        lines.append('],')
    lines[-1] = ']'
    lines += ['};', '',
              '/* Quest XP. xp: fixed rewards. lamps: skill-choice rewards as text, lampXp their total. need: skill levels the wiki lists. mini: a miniquest. */',
              'const QUESTS=[']
    for i, q in enumerate(quests):
        lines.append(js(q) + (',' if i < len(quests) - 1 else ''))
    lines += ['];', '',
              "/* Timed resets. every: minutes, 'utc' (resets at 00:00 UTC), 'weekly' (seven days after the last one), or [[level, minutes], ...] by the reset's skill. */",
              'const RESETS=[']
    for i, r in enumerate(resets):
        lines.append(js(r) + (',' if i < len(resets) - 1 else ''))
    lines += ['];', '']

    with io.open(os.path.join(ROOT, 'data.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))

    if '--data-only' in sys.argv:
        print('wrote data.js')
        return

    # Stitch the single page the server serves.
    parts = []
    # local_sync.js is a private add-on that only exists in one local copy; the published code does not have it
    for name in ('head.html', None, 'data.js', 'local_sync.js', 'app.js'):
        if name is None:
            parts.append('<script>\n')
            continue
        if name == 'local_sync.js' and not os.path.isfile(os.path.join(ROOT, name)):
            continue
        with io.open(os.path.join(ROOT, name), encoding='utf-8', newline='') as f:
            parts.append(f.read())
    parts.append('</script>\n</body></html>\n')
    with io.open(os.path.join(ROOT, 'longgame.html'), 'w', encoding='utf-8', newline='') as f:
        f.write(''.join(parts))
    print('wrote data.js and longgame.html')


if __name__ == '__main__':
    main()

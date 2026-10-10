#!/usr/bin/env python3
"""Build the public website into ./site.

    python tools/build_site.py

It rebuilds data.js first, then writes:
  site/index.html            the planner, with a description of the product search engines can read
  site/guides/...            one page of training methods per skill, plus an AFK page, generated from datasrc/
  site/data/methods.json     the method data, published under the wiki's licence
  site/llms.txt, llms-full.txt, robots.txt, sitemap.xml, 404.html, _headers
Settings come from site.config.json: "url" (the public address, no trailing slash) and "repo" (owner/name on GitHub).
"""
import glob
import hashlib
import html
import io
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
WIKI = 'https://oldschool.runescape.wiki/w/'
CREDIT = ("Long Game is a free fan project. Created using intellectual property belonging to Jagex Limited under the terms of "
          "Jagex’s Fan Content Policy. This content is not endorsed by or affiliated with Jagex.")
TITLE = 'Long Game: OSRS maxing planner and skill training tracker'
DESC = ('Free Old School RuneScape maxing planner. Enter your name to see all 24 skillcapes, the hours left to max, '
        'and a training session built for your account.')
MARK = ('<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke-width="9.5"><circle cx="32" cy="26" r="14" stroke="#7d7a0a"/>'
        '<path d="M46 26V37c0 9.5-6 15-15 15h-5" stroke="#7d7a0a"/><path d="M32 12A14 14 0 1 1 18 26" stroke="#16120f"/></g></svg>')
INT = {'afk': 'AFK', 'semi': 'Semi-AFK', 'active': 'Active'}
FAQ = [
    ('Is Long Game free?', 'Yes. It is a free fan project with no adverts, no account and nothing to pay for.'),
    ('Do I need to log in or give a password?', 'No. You only type your display name. Long Game looks it up on the official Old School RuneScape hiscores, which are public. It never asks for a password and cannot touch your account.'),
    ('Does it work for ironmen?', 'Yes. It tells a main from an ironman from the hiscores and plans with the ironman routes from the wiki, leaving out every method that needs the Grand Exchange.'),
    ('How does it know how long maxing will take?', 'For each skill it takes the XP you have left and the fastest method your levels, quests and diaries allow at each level, using the hourly rates on the Old School RuneScape Wiki. Where the wiki gives no rate it says the figure is rough.'),
    ('Why do I have to tick my quests by hand?', 'The public hiscores list your levels but not your quests or diaries, and there is no public source for those, so you tick what you have done yourself. It takes a minute, and there are shortcuts if you have the quest cape or every diary.'),
    ('Where do the training methods come from?', 'Every method and rate is adapted from the Old School RuneScape Wiki and credited to it. The data is published under the same licence, CC BY-NC-SA 3.0.'),
    ('Where is my data kept?', 'In your own browser. Your sessions, ticks and XP history are not sent anywhere. You can export them to a file from Settings.'),
    ('Is this made by Jagex?', 'No. Long Game is not endorsed by or affiliated with Jagex.'),
]
EXTRA_CSS = """
/* ---- website only: the product description and the guide pages ---- */
.lg-in #about{display:none}
.nav a{border-bottom:3px solid transparent;color:var(--ink-2);font:600 15px/1 var(--f);padding:11px 13px 8px;white-space:nowrap;text-decoration:none}
.nav a:hover{color:#fff}
.nav a.on{color:#fff;border-color:var(--stat)}
a.btn{text-decoration:none;display:inline-block}
.about{padding-top:40px;padding-bottom:28px}
.about h2{font-size:26px;line-height:1.1;margin:44px 0 12px}
.about h2:first-child{margin-top:0}
.about .lead{font-size:17px;color:var(--bone);max-width:68ch}
.feat{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px 48px;margin-top:26px}
.feat .ft{display:grid;grid-template-columns:46px minmax(0,1fr);gap:18px;align-items:start}
.feat .mini{position:relative;display:block;width:46px;aspect-ratio:320/622}
.feat h3{font-size:17px;font-weight:700;letter-spacing:0;margin-bottom:4px}
.feat p,.faq dd{color:var(--ink-2);max-width:62ch}
.glinks{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px;list-style:none;margin:0;padding:0}
.glinks a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r);background:var(--slot);color:var(--bone);text-decoration:none;font-weight:600}
.glinks a:hover{background:var(--lift);color:#fff}
.glinks small{margin-left:auto;color:var(--ink-3);font-weight:500;font-size:13px;white-space:nowrap}
.glinks{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
.req{font-style:normal;color:var(--ink-3)}
.faq{margin:0}
.faq dt{font-weight:700;color:#fff;margin-top:16px}
.faq dd{margin:4px 0 0}
.crumbs{font-size:13px;color:var(--ink-3);margin-bottom:14px}
.crumbs a{color:var(--ink-2)}
.g-head{display:grid;grid-template-columns:150px minmax(0,1fr);gap:28px;align-items:center;margin-bottom:8px}
.g-head .crest{margin:0;height:196px}
.g-head .crest img{left:calc(50% - 44px);width:88px}
.g-head h1{font-size:34px;line-height:1.05;margin-bottom:10px;display:flex;align-items:center;gap:12px}
.g-head p{color:var(--ink-2);max-width:70ch}
.g-head p+p{margin-top:8px}
.cta{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:22px 0 26px}
.cta span{color:var(--ink-2)}
.src{color:var(--ink-3);font-size:13px;margin-top:22px;max-width:96ch}
.src a{color:var(--ink-2)}
@media (max-width:760px){.feat{grid-template-columns:minmax(0,1fr)}.g-head{grid-template-columns:minmax(0,1fr)}.g-head .crest{display:none}.g-head h1{font-size:28px}}
"""

# The product description comes in as you scroll to it, and each cape beside a feature fills as it arrives.
# Without script or with reduced motion everything is simply there.
REVEAL_JS = """(function(){
  if(!window.gsap||!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var io=new IntersectionObserver(function(es){es.forEach(function(x){
    if(!x.isIntersecting)return;io.unobserve(x.target);var im=x.target.querySelector('.im');
    gsap.to(x.target,{autoAlpha:1,y:0,duration:.5,ease:'power2.out',clearProps:'transform,opacity,visibility'});
    if(im)gsap.fromTo(im,{'--p':'0%'},{'--p':im.getAttribute('data-p'),duration:1.1,delay:.15,ease:'power2.out'});
  });},{rootMargin:'0px 0px -12% 0px'});
  [].forEach.call(document.querySelectorAll('#about [data-reveal]'),function(el){
    if(el.getBoundingClientRect().top>innerHeight*.9)gsap.set(el,{autoAlpha:0,y:18});
    io.observe(el);
  });
})();"""

e = lambda s: html.escape(str(s), quote=True)


def read(*p):
    with io.open(os.path.join(ROOT, *p), encoding='utf-8') as f:
        return f.read()


def write(rel, text):
    path = os.path.join(SITE, *rel.split('/'))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def k(n):
    n = float(n)
    if n >= 1e6:
        return ('%.2f' % (n / 1e6)).rstrip('0').rstrip('.') + 'M'
    return '%dk' % round(n / 1000) if n >= 1000 else str(int(round(n)))


def rate(m):
    if m.get('run') and m.get('per'):
        return '≈ %s a run' % k(m['per'])
    if m.get('calc'):
        return 'depends on your levels'
    vals = [v for v in [m.get('xph', 0)] + [b[1] for b in m.get('bands', [])] if v]
    if not vals:
        return 'no hourly rate'
    lo, hi = min(vals), max(vals)
    return '≈ %s an hour' % k(lo) if lo == hi else '≈ %s to %s an hour' % (k(lo), k(hi))


def needs(req):
    out = []
    for part in (req or '').split(';'):
        if ':' not in part:
            continue
        t, v = part.split(':', 1)
        if t == 'q':
            out.append(', '.join(v.split('|')))
        elif t == 'd':
            out += [d + ' diary' for d in v.split('|')]
        elif t == 'c':
            out.append(v + ' combat')
        elif t == 's':
            for x in v.split(','):
                mm = re.match(r'^\s*(\w+)\s+(\d+)\s*$', x)
                if mm:
                    out.append('%s %s' % (mm.group(2), mm.group(1).capitalize()))
    return ', '.join(out)


def top(m):
    return max([m.get('xph', 0)] + [x[1] for x in m.get('bands', [])])


def best(ms, pred):
    c = [m for m in ms if pred(m) and top(m) and not m.get('run') and not m.get('calc')]
    return max(c, key=top) if c else None


def main():
    cfg = json.loads(read('site.config.json'))
    base = (cfg.get('url') or '').rstrip('/')
    repo = cfg.get('repo') or ''
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'build_data.py')])
    if os.path.isdir(SITE):
        shutil.rmtree(SITE)
    os.makedirs(SITE)

    # ---- what the pages share ----
    head = read('head.html')
    css = re.search(r'<style>(.*?)</style>', head, re.S).group(1).replace('url(assets/', 'url(/assets/') + EXTRA_CSS
    fonts = '\n'.join(l for l in head.splitlines() if 'fonts.g' in l)
    icon = re.search(r'<link rel="icon"[^>]*>', head).group(0)
    skills = {}
    for path in sorted(glob.glob(os.path.join(ROOT, 'datasrc', 'methods', '*.json'))):
        d = json.loads(io.open(path, encoding='utf-8').read())
        skills[d['skill']] = sorted(d['methods'], key=lambda m: m['lv'])
    total = sum(len(v) for v in skills.values())
    brand = '<a class="brand" href="/" aria-label="Long Game"><span class="tile">%s</span><span class="wm" aria-hidden="true">lon<span>9</span> <span>9</span>ame</span></a>' % MARK
    foot = ('<footer class="foot wrap"><p>%s</p><p>Training methods and rates are adapted from the <a href="https://oldschool.runescape.wiki/" rel="noopener">Old School RuneScape Wiki</a>, '
            'used under <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" rel="noopener">CC BY-NC-SA 3.0</a>. The <a href="/data/methods.json">method data</a> is published under the same licence.%s</p></footer>'
            ) % (e(CREDIT), ' The code is on <a href="https://github.com/%s" rel="noopener">GitHub</a>.' % e(repo) if repo else '')

    def meta(title, desc, path):
        url = base + path if base else ''
        m = ['<title>%s</title>' % e(title), '<meta name="description" content="%s">' % e(desc), '<meta name="theme-color" content="#191411">',
             '<meta property="og:type" content="website">', '<meta property="og:site_name" content="Long Game">',
             '<meta property="og:title" content="%s">' % e(title), '<meta property="og:description" content="%s">' % e(desc),
             '<meta name="twitter:card" content="summary_large_image">']
        if url:
            m += ['<link rel="canonical" href="%s">' % e(url), '<meta property="og:url" content="%s">' % e(url)]
            if os.path.isfile(os.path.join(ROOT, 'web', 'og.png')):
                m += ['<meta property="og:image" content="%s/og.png">' % e(base), '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">']
        return '\n'.join(m)

    def page(title, desc, path, body, ld=None, nav='guides'):
        return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n%s\n%s\n%s\n<style>%s</style>\n%s</head>\n<body>\n'
                '<header class="top"><div class="wrap">%s<nav class="nav" aria-label="Site"><a href="/"%s>Planner</a><a href="/guides/"%s>Training guides</a></nav></div></header>\n'
                '<main class="wrap">%s</main>\n%s\n</body></html>\n') % (
            meta(title, desc, path), icon, fonts, css, '<script type="application/ld+json">%s</script>\n' % json.dumps(ld, ensure_ascii=False) if ld else '',
            brand, ' class="on"' if nav == 'home' else '', ' class="on"' if nav == 'guides' else '', body, foot)

    def table(rows, with_skill=False):
        h = '<div class="twrap"><table class="tt methods rows-top"><thead><tr>%s<th class="num">Level</th><th>Method</th><th class="num">XP</th><th>Attention</th><th>For</th></tr></thead><tbody>' % ('<th>Skill</th>' if with_skill else '')
        for sk, m in rows:
            who = {'main': 'Mains', 'iron': 'Ironmen'}.get(m.get('who'), 'Everyone')
            n = needs(m.get('req'))
            h += '<tr>%s<td class="num lvl">%d</td><td class="blk"><b>%s</b>%s<span>%s%s</span></td><td class="num">%s</td><td><span class="pace p-%s"><i></i>%s</span></td><td class="nowrap">%s</td></tr>' % (
                '<td class="nowrap"><a href="/guides/%s/">%s</a></td>' % (sk, sk.capitalize()) if with_skill else '', m['lv'], e(m['name']),
                '<span class="mark">Timed run</span>' if m.get('run') else '', e(m.get('note', '')), ' <em class="req">Needs %s.</em>' % e(n) if n else '',
                rate(m), m['int'], INT[m['int']], who)
        return h + '</tbody></table></div>'

    def sources(ms):
        src = sorted({m['src'] for m in ms if m.get('src')})
        return '<p class="src">Adapted from the Old School RuneScape Wiki: %s. Rates are the wiki’s and assume its listed setups. Licensed CC BY-NC-SA 3.0.</p>' % ', '.join(
            '<a href="%s%s" rel="noopener">%s</a>' % (WIKI, e(s.replace(' ', '_')), e(s)) for s in src)

    cta = '<div class="cta"><a class="btn pri" href="/">Open the planner</a><span>Type your name to see which of these your account has unlocked.</span></div>'

    # ---- one page per skill ----
    for sk, ms in skills.items():
        name = sk.capitalize()
        fast, afk = best(ms, lambda m: True), best(ms, lambda m: m['int'] == 'afk')
        n_afk = sum(1 for m in ms if m['int'] == 'afk')
        facts = '%d ways to train %s in Old School RuneScape, from level %d to 99, with the XP an hour the wiki gives for each, how much attention it takes and what it needs.' % (len(ms), name, ms[0]['lv'])
        more = []
        if fast:
            more.append('The fastest listed is %s at up to about %s XP an hour, from level %d.' % (fast['name'], k(top(fast)), fast['lv']))
        if afk and afk is not fast:
            more.append('The best AFK option is %s at up to about %s XP an hour, from level %d.' % (afk['name'], k(top(afk)), afk['lv']))
        elif not n_afk:
            more.append('None of them is fully AFK.')
        title = 'OSRS %s training methods 1-99: XP rates for mains and ironmen | Long Game' % name
        desc = ('%s training in OSRS: %d methods from level %d to 99 with XP rates, AFK options, requirements and ironman routes.' % (name, len(ms), ms[0]['lv']))[:158]
        body = ('<p class="crumbs"><a href="/">Long Game</a> / <a href="/guides/">Training guides</a> / %s</p>'
                '<div class="g-head"><div class="crest" style="--cape:%s"><img src="/assets/osrs/capes-md/%s.webp" alt="%s skillcape" width="88" height="171"></div>'
                '<div><h1><span class="ic l"><img src="/assets/osrs/icons/%s.png" alt=""></span>%s training methods, level 1 to 99</h1><p>%s</p><p>%s</p></div></div>%s%s%s') % (
            name, CAPES.get(sk, '#2c241d'), sk, name, sk, name, e(facts), e(' '.join(more)), cta, table([(sk, m) for m in ms]), sources(ms))
        ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': '%s training methods, level 1 to 99' % name, 'description': desc,
              'about': 'Old School RuneScape %s' % name, 'isAccessibleForFree': True, 'license': 'https://creativecommons.org/licenses/by-nc-sa/3.0/'}
        write('guides/%s/index.html' % sk, page(title, desc, '/guides/%s/' % sk, body, ld))

    # ---- every AFK method ----
    afk_rows = [(sk, m) for sk, ms in skills.items() for m in ms if m['int'] == 'afk']
    title = 'OSRS AFK training methods for every skill | Long Game'
    desc = 'Every AFK training method in Old School RuneScape, skill by skill: %d methods with levels, XP rates and requirements.' % len(afk_rows)
    body = ('<p class="crumbs"><a href="/">Long Game</a> / <a href="/guides/">Training guides</a> / AFK</p><div class="g-head" style="grid-template-columns:minmax(0,1fr)"><div><h1>AFK training methods for every skill</h1>'
            '<p>%d methods across %d skills that need a click every few minutes at most, with the level each one opens at and the XP an hour the wiki gives.</p></div></div>%s%s%s') % (
        len(afk_rows), len({s for s, _ in afk_rows}), cta, table(afk_rows, True), sources([m for _, m in afk_rows]))
    write('guides/afk/index.html', page(title, desc, '/guides/afk/', body))

    # ---- the guide index ----
    links = ''.join('<li><a href="/guides/%s/"><span class="ic"><img src="/assets/osrs/icons/%s.png" alt=""></span>%s<small>%d methods</small></a></li>' % (sk, sk, sk.capitalize(), len(ms)) for sk, ms in skills.items())
    title = 'OSRS training guides: every method for every skill | Long Game'
    desc = 'Training methods for all %d trainable skills in Old School RuneScape: %d methods with levels, XP rates, AFK options and ironman routes.' % (len(skills), total)
    body = ('<p class="crumbs"><a href="/">Long Game</a> / Training guides</p><div class="g-head" style="grid-template-columns:minmax(0,1fr)"><div><h1>Training methods for every skill</h1>'
            '<p>%d methods across %d skills, each with the level it opens at, the XP an hour the wiki gives, how much attention it takes and what it needs. Hitpoints trains itself through combat.</p></div></div>'
            '<ul class="glinks">%s<li><a href="/guides/afk/">Every AFK method<small>%d methods</small></a></li></ul>%s') % (total, len(skills), links, len(afk_rows), cta)
    write('guides/index.html', page(title, desc, '/guides/', body))

    # ---- the planner ----
    feats = [
        ('max', 68, 'See the whole grind at once', 'Every skill is a cape that fills with colour as you level. You see the levels left, the hours left at the best methods open to you, and which capes are closest.'),
        ('woodcutting', 76, 'Get tonight’s session dealt for you', 'Say how long you have and how much attention you can spare. Long Game deals a session of timed blocks from AFK, semi-AFK or active methods your account has actually unlocked, plus any farm or birdhouse runs that are due.'),
        ('smithing', 61, 'Built for mains and ironmen', 'It tells a main from an ironman from the hiscores and plans accordingly. Ironmen get the wiki’s ironman routes, with no method that needs the Grand Exchange.'),
        ('firemaking', 87, 'Track what you gained', 'Finish a session and it tallies the XP from the hiscores, keeps a 14-day history and counts your streak. Everything is saved in your own browser.'),
    ]
    about = ('<section id="about"><div class="wrap about"><h2>A maxing planner that knows your account</h2>'
             '<p class="lead">Long Game is a free companion for Old School RuneScape players working toward the max cape. Type your display name and it reads your levels from the official hiscores, hangs all 24 skillcapes on one rail, and shows how far each one is from 99.</p>'
             '<div class="feat">%s</div><h2>Training methods for every skill</h2><ul class="glinks" data-reveal>%s<li><a href="/guides/afk/">Every AFK method<small>%d methods</small></a></li></ul>'
             '<h2>Questions</h2><dl class="faq" data-reveal>%s</dl></div>%s</section>') % (
        ''.join('<div class="ft" data-reveal><span class="mini im" style="--p:%d%%" data-p="%d%%"><img class="dim" src="/assets/osrs/capes-md/%s.webp" alt=""><img class="lit" src="/assets/osrs/capes-md/%s.webp" alt=""></span><div><h3>%s</h3><p>%s</p></div></div>'
                % (p, p, c, c, e(a), e(b)) for c, p, a, b in feats), links, len(afk_rows),
        ''.join('<dt>%s</dt><dd>%s</dd>' % (e(q), e(a)) for q, a in FAQ), foot)
    app = {'@type': 'WebApplication', 'name': 'Long Game', 'description': DESC, 'applicationCategory': 'UtilitiesApplication', 'operatingSystem': 'Any',
           'browserRequirements': 'Requires JavaScript', 'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'GBP'}}
    if base:
        app['url'] = base + '/'
    ld = {'@context': 'https://schema.org', '@graph': [app, {'@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in FAQ]}]}
    stamp = {}
    for f in ('data.js', 'app.js'):
        src = read(f)
        stamp[f] = hashlib.sha1(src.encode('utf-8')).hexdigest()[:10]
        write(f, src)
    index = head.replace('<title>Long Game</title>', meta(TITLE, DESC, '/')).replace('url(assets/', 'url(/assets/').replace('</style>', EXTRA_CSS + '</style>', 1)
    index = index.replace('</head>', '<script type="application/ld+json">%s</script>\n</head>' % json.dumps(ld, ensure_ascii=False))
    index += ('%s\n<script>window.LG=%s</script>\n<script src="data.js?v=%s"></script>\n<script src="app.js?v=%s"></script>\n<script>%s</script>\n</body></html>\n'
              % (about, json.dumps({'hosted': True, 'api': '', 'repo': repo, 'url': base}), stamp['data.js'], stamp['app.js'], REVEAL_JS))
    write('index.html', index)
    write('404.html', page('Page not found | Long Game', 'That page does not exist.', '/404.html',
                           '<div class="g-head" style="grid-template-columns:minmax(0,1fr)"><div><h1>That page is not here</h1><p>The address may be wrong, or the page may have moved.</p></div></div>'
                           '<div class="cta"><a class="btn pri" href="/">Open the planner</a><a class="btn" href="/guides/">Training guides</a></div>', nav=''))

    # ---- data, and the files crawlers and AI assistants read ----
    write('data/methods.json', json.dumps({'licence': 'CC BY-NC-SA 3.0', 'source': 'Adapted from the Old School RuneScape Wiki, https://oldschool.runescape.wiki/',
                                           'skills': skills}, ensure_ascii=False, separators=(',', ':')))
    pages = ['/', '/guides/', '/guides/afk/'] + ['/guides/%s/' % sk for sk in skills]
    u = lambda p: (base + p) if base else p
    llms = ['# Long Game', '', '> ' + DESC, '',
            'Long Game is a free, browser-based planner for Old School RuneScape (OSRS) players working toward the max cape. A player types their display name; it reads their levels from the public hiscores, shows all 24 skillcapes filling toward level 99, estimates the hours left to max, and deals timed training sessions from methods that account has unlocked. It handles mains and ironmen separately.',
            '', '## Key facts', '', '- Free. No adverts, no login, no password. Only a display name is needed.', '- Player data stays in the player’s browser.',
            '- %d training methods across %d skills, adapted from the Old School RuneScape Wiki under CC BY-NC-SA 3.0.' % (total, len(skills)),
            '- A fan project. Not endorsed by or affiliated with Jagex.', '', '## Pages', '', '- [Planner](%s): the app' % u('/'),
            '- [Training guides](%s): every method for every skill' % u('/guides/'), '- [AFK methods](%s): every AFK method across all skills' % u('/guides/afk/')]
    llms += ['- [%s training](%s): %d methods, level %d to 99' % (sk.capitalize(), u('/guides/%s/' % sk), len(ms), ms[0]['lv']) for sk, ms in skills.items()]
    llms += ['', '## Data', '', '- [All methods as JSON](%s)' % u('/data/methods.json'), '- [All methods as text](%s)' % u('/llms-full.txt'), '', '## Questions', '']
    llms += ['- %s %s' % (q, a) for q, a in FAQ]
    write('llms.txt', '\n'.join(llms) + '\n')
    full = ['# Long Game: every OSRS training method', '', 'Adapted from the Old School RuneScape Wiki (https://oldschool.runescape.wiki/), CC BY-NC-SA 3.0. Rates are the wiki’s and assume its listed setups.', '']
    for sk, ms in skills.items():
        full += ['## %s' % sk.capitalize(), '', '| Level | Method | XP | Attention | For | Needs | Notes |', '|---|---|---|---|---|---|---|']
        full += ['| %d | %s | %s | %s | %s | %s | %s |' % (m['lv'], m['name'], rate(m), INT[m['int']], {'main': 'Mains', 'iron': 'Ironmen'}.get(m.get('who'), 'Everyone'),
                                                    needs(m.get('req')) or 'nothing', m.get('note', '').replace('|', '/')) for m in ms] + ['']
    write('llms-full.txt', '\n'.join(full))
    write('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /api/\n' + ('\nSitemap: %s/sitemap.xml\n' % base if base else ''))
    if base:
        write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % ''.join('<url><loc>%s%s</loc></url>\n' % (base, p) for p in pages))
    write('_headers', '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n'
                      '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n')

    # ---- files ----
    for d in ('icons', 'capes-md', 'fonts'):
        shutil.copytree(os.path.join(ROOT, 'assets', 'osrs', d), os.path.join(SITE, 'assets', 'osrs', d))
    shutil.copytree(os.path.join(ROOT, 'assets', 'fonts'), os.path.join(SITE, 'assets', 'fonts'))
    shutil.copytree(os.path.join(ROOT, 'vendor'), os.path.join(SITE, 'vendor'))
    if os.path.isfile(os.path.join(ROOT, 'web', 'og.png')):
        shutil.copy(os.path.join(ROOT, 'web', 'og.png'), os.path.join(SITE, 'og.png'))
    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(SITE) for f in fs)
    print('wrote site/: %d pages, %d methods, %.1f MB' % (len(pages) + 1, total, size / 1e6))
    if not base:
        print('note: site.config.json has no "url" yet, so there are no canonical links and no sitemap')


# each skillcape's colour, for the crest on a guide page (the same values as CAPE in app.js)
CAPES = {'attack': '#6e1e16', 'defence': '#687bb7', 'strength': '#0b6944', 'hitpoints': '#a5a4a1', 'ranged': '#546a1f', 'prayer': '#cdc5c5', 'magic': '#988c78',
         'cooking': '#52245e', 'woodcutting': '#887143', 'fletching': '#194c4e', 'fishing': '#839fb8', 'firemaking': '#bb6b1a', 'crafting': '#775d46',
         'smithing': '#565546', 'mining': '#595847', 'herblore': '#0a600d', 'agility': '#34356e', 'thieving': '#6e445f', 'slayer': '#2a2526',
         'farming': '#2d582e', 'runecraft': '#a3a398', 'hunter': '#696347', 'construction': '#948a77', 'sailing': '#2c597b'}

if __name__ == '__main__':
    main()

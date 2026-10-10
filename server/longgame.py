#!/usr/bin/env python3
"""Long Game: a local server that serves the app and fetches your OSRS data for it.

Run it with `python longgame.py --open` (or double-click "Long Game.bat").
Everything it saves lives in the data/ folder next to this file.
"""
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the project folder, one up from server/
DATA = os.path.join(ROOT, 'data')
PORT = int(os.environ.get('LONGGAME_PORT', '8765'))
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/128.0 Safari/537.36')
HISCORES = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player='
HISCORES_IRON = 'https://secure.runescape.com/m=hiscore_oldschool_ironman/index_lite.json?player='
sys.path.insert(0, os.path.join(ROOT, 'local'))
try:
    import local_sync  # a private add-on for one local copy (local/); not part of the published code
except ImportError:
    local_sync = None
STATIC_OK = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
             '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ico': 'image/x-icon',
             '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'}
CACHED = ('.png', '.webp', '.ttf', '.woff2')  # game art and fonts never change between builds


def fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-GB,en;q=0.9',
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode('utf-8', 'replace')


def safe_name(name):
    return ''.join(c for c in name.strip().lower().replace(' ', '_') if c.isalnum() or c in '_-') or 'player'


def read_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f)
    os.replace(tmp, path)


class Handler(BaseHTTPRequestHandler):
    server_version = 'LongGame/1.0'

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    # ---- helpers ----
    def send_json(self, obj, status=200):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext not in STATIC_OK or not os.path.isfile(path):
            self.send_json({'error': 'not found'}, 404)
            return
        with open(path, 'rb') as f:
            body = f.read()
        self.send_response(200)
        self.send_header('Content-Type', STATIC_OK[ext])
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'max-age=604800' if ext in CACHED else 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def body_json(self):
        length = int(self.headers.get('Content-Length', '0') or 0)
        raw = self.rfile.read(length) if length else b''
        try:
            return json.loads(raw or b'{}')
        except Exception:
            return {}

    # ---- routes ----
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        name = q.get('name', [''])[0].strip()

        if u.path == '/api/hiscores':
            if not name:
                return self.send_json({'error': 'no name'}, 400)
            try:
                _, body = fetch(HISCORES + urllib.parse.quote(name))
                data = json.loads(body)
                data['fetched'] = int(time.time() * 1000)
                return self.send_json(data)
            except urllib.error.HTTPError as e:
                msg = 'No hiscores entry for that name. Check the spelling, and note that brand-new accounts need a few levels first.' if e.code == 404 else 'Hiscores returned %d.' % e.code
                return self.send_json({'error': msg}, 502)
            except Exception as e:
                return self.send_json({'error': 'Could not reach the hiscores: %s' % e}, 502)

        if u.path == '/api/acctype':
            # An account is only on the ironman hiscores if it is an ironman.
            if not name:
                return self.send_json({'error': 'no name'}, 400)
            try:
                fetch(HISCORES_IRON + urllib.parse.quote(name))
                return self.send_json({'type': 'ironman'})
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return self.send_json({'type': 'main'})
                return self.send_json({'error': 'Hiscores returned %d.' % e.code}, 502)
            except Exception as e:
                return self.send_json({'error': 'Could not reach the hiscores: %s' % e}, 502)

        if u.path == '/api/wikisync':
            if local_sync is None:
                return self.send_json({'error': 'not available'}, 404)
            return local_sync.handle(self, name, fetch)

        if u.path == '/api/state':
            return self.send_json(read_json(os.path.join(DATA, 'state.json'), {}))

        if u.path == '/api/snapshots':
            return self.send_json(read_json(os.path.join(DATA, 'snapshots_%s.json' % safe_name(name)), []))

        # static
        path = '/build/longgame.html' if u.path in ('/', '') else u.path
        full = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
        if not full.startswith(ROOT):
            return self.send_json({'error': 'nope'}, 403)
        return self.send_file(full)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        body = self.body_json()

        if u.path == '/api/state':
            write_json(os.path.join(DATA, 'state.json'), body)
            return self.send_json({'ok': True})

        if u.path == '/api/snapshot':
            name = safe_name(str(body.get('name', '')))
            path = os.path.join(DATA, 'snapshots_%s.json' % name)
            snaps = read_json(path, [])
            snap = {'t': int(time.time() * 1000), 'skills': body.get('skills', {}), 'total': body.get('total', 0)}
            # Nothing new: slide the trailing duplicate forward, but keep the snapshot
            # where this XP first showed up so the gain stays on the day it was earned.
            if len(snaps) > 1 and snaps[-1].get('skills') == snap['skills'] == snaps[-2].get('skills'):
                snaps[-1]['t'] = snap['t']
                write_json(path, snaps)
                return self.send_json({'ok': True, 'unchanged': True, 'count': len(snaps)})
            snaps.append(snap)
            if len(snaps) > 5000:
                snaps = snaps[-5000:]
            write_json(path, snaps)
            return self.send_json({'ok': True, 'count': len(snaps)})

        return self.send_json({'error': 'not found'}, 404)


def main():
    global PORT
    os.makedirs(DATA, exist_ok=True)
    httpd = None
    for port in range(PORT, PORT + 10):
        try:
            httpd = ThreadingHTTPServer(('127.0.0.1', port), Handler)
            PORT = port
            break
        except OSError:
            continue
    if httpd is None:
        print('Could not find a free port near %d.' % PORT)
        sys.exit(1)
    url = 'http://localhost:%d/' % PORT
    print('Long Game is running at %s' % url)
    print('Leave this window open while you play. Close it to stop.')
    if '--open' in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()

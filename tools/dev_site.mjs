// Run the public site on this machine, with the real relay code, before it goes anywhere:
//   python tools/build_site.py
//   node tools/dev_site.mjs            (Node 18 or newer; port 8793, or set PORT)
// Suggestions need GITHUB_TOKEN and GITHUB_REPO in the environment; without them the form says it is switched off.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../relay/worker.js';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const port = Number(process.env.PORT || 8793);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

// what Cloudflare's static file binding does: serve the file, a folder's index.html, or the 404 page
const ASSETS = {
  async fetch(request) {
    let p = path.normalize(path.join(site, decodeURIComponent(new URL(request.url).pathname)));
    if (!p.startsWith(site)) return new Response('no', { status: 403 });
    try {
      if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
    } catch (e) {
      /* falls through to the 404 below */
    }
    try {
      return new Response(await readFile(p), {
        headers: { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' },
      });
    } catch (e) {
      return new Response(await readFile(path.join(site, '404.html')), {
        status: 404,
        headers: { 'Content-Type': types['.html'] },
      });
    }
  },
};
const env = {
  ASSETS,
  SITE_URL: process.env.SITE_URL || '',
  GITHUB_REPO: process.env.GITHUB_REPO || '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
};

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request('http://127.0.0.1:' + port + req.url, {
      method: req.method,
      headers: req.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    try {
      const r = await worker.fetch(request, env, { waitUntil() {} });
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  })
  .listen(port, '127.0.0.1', () => console.log('Long Game site on http://127.0.0.1:' + port));

// Local preview: builds, then serves dist/ at http://localhost:4173 and rebuilds on every page load.
// Usage: node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const port = Number(process.argv[2] ?? 4319);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const build = () => execFileSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { stdio: 'pipe' }).toString().trim();

console.log(build());
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (path === '/' || path === '/index.html') console.log(build());
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    return res.end(e.stderr?.toString() || String(e));
  }
  if (path === '/status.json') return status(res);
  const file = normalize(join(dist, path === '/' ? 'index.html' : path));
  if (!file.startsWith(dist) || file.endsWith('tools.txt')) return res.writeHead(404).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`preview at http://localhost:${port}`));

// the same answer the container's status-loop.sh writes, checked live from this machine
async function status(res) {
  const urls = (await readFile(join(dist, 'tools.txt'), 'utf8')).split(/\r?\n/).filter(Boolean);
  const tools = {};
  await Promise.all(
    urls.map(async (url) => {
      const t0 = performance.now();
      try {
        const r = await fetch(`${url}/`, { signal: AbortSignal.timeout(8000), redirect: 'manual' });
        tools[url] = { up: r.status < 500, ms: Math.round(performance.now() - t0), code: r.status };
      } catch {
        tools[url] = { up: false, ms: 0, code: 0 };
      }
    }),
  );
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ checkedAt: new Date().toISOString(), tools }));
}

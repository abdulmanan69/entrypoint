// Builds dist/ from tools.json and src/. No dependencies: Node 18+ only.
// Usage: node scripts/build.mjs [--check]   (--check validates tools.json and writes nothing)
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => join(root, 'src', p);
const out = (p) => join(root, 'dist', p);
const read = (p) => readFileSync(p, 'utf8');
const checkOnly = process.argv.includes('--check');

const TINTS = ['indigo', 'green', 'amber', 'rose', 'slate'];
const PREVIEWS = readdirSync(src('previews')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fill = (tpl, vars) =>
  tpl.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error(`template uses {{${k}}} but no value was given`);
    return vars[k];
  });

// validate tools.json and say exactly what is wrong
let config;
try {
  config = JSON.parse(read(join(root, 'tools.json')));
} catch (e) {
  fail(`tools.json is not valid JSON: ${e.message}`);
}
const problems = [];
const site = config.site ?? {};
for (const f of ['name', 'title', 'intro']) if (!site[f]) problems.push(`site.${f} is missing`);
const clocks = site.clocks ?? [];
clocks.forEach((c, i) => {
  if (!c.label || !c.timeZone) problems.push(`site.clocks[${i}] needs label and timeZone`);
  else {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: c.timeZone });
    } catch {
      problems.push(`site.clocks[${i}].timeZone "${c.timeZone}" is not a time zone (use names like Asia/Karachi)`);
    }
  }
});
const tools = config.tools ?? [];
if (!tools.length) problems.push('tools is empty: add at least one tool');
const keys = new Set();
tools.forEach((t, i) => {
  const at = `tools[${i}]${t.name ? ` (${t.name})` : ''}`;
  if (!t.name) problems.push(`${at}: name is missing`);
  if (!t.description) problems.push(`${at}: description is missing`);
  let url;
  try {
    url = new URL(t.url);
    if (url.protocol !== 'https:') problems.push(`${at}: url must start with https://`);
  } catch {
    problems.push(`${at}: url "${t.url}" is not a full URL`);
  }
  if (t.key !== undefined) {
    if (!/^[a-z0-9]$/.test(t.key)) problems.push(`${at}: key must be one lowercase letter or digit`);
    else if (keys.has(t.key)) problems.push(`${at}: key "${t.key}" is already used by another tool`);
    else keys.add(t.key);
  }
  const preview = t.preview ?? 'window';
  if (!PREVIEWS.includes(preview)) problems.push(`${at}: preview "${preview}" does not exist (choose ${PREVIEWS.join(', ')})`);
  const tint = t.tint ?? 'slate';
  if (!TINTS.includes(tint)) problems.push(`${at}: tint "${tint}" does not exist (choose ${TINTS.join(', ')})`);
});
if (problems.length) fail(`tools.json has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
if (checkOnly) {
  console.log(`tools.json ok: ${tools.length} tools`);
  process.exit(0);
}

// render
const css = read(src('styles.css'));
const js = read(src('app.js'));
const version = createHash('sha256').update(css).update(js).digest('hex').slice(0, 10);
const card = read(src('card.html'));
const cards = tools
  .map((t) => {
    const url = new URL(t.url);
    const vars = {
      NAME: esc(t.name),
      URL: esc(url.origin + (url.pathname === '/' ? '' : url.pathname.replace(/\/$/, ''))),
      HOST: esc(url.host),
      DESCRIPTION: esc(t.description),
      KEY: esc(t.key ?? ''),
      KEYCAP: t.key ? `<kbd>${esc(t.key.toUpperCase())}</kbd>` : '',
      TINT: t.tint ?? 'slate',
    };
    vars.PREVIEW = fill(read(src(`previews/${t.preview ?? 'window'}.html`)), vars).trimEnd();
    return fill(card, vars).trimEnd();
  })
  .join('\n\n');

const clockHtml = clocks
  .map(
    (c) =>
      `<span class="clock"><span class="clock-city">${esc(c.label)}</span><span class="clock-short">${esc(c.short ?? c.label)}</span> <time data-tz="${esc(c.timeZone)}">--:--</time></span>`,
  )
  .join('');
const withKeys = tools.filter((t) => t.key).map((t) => `<kbd>${esc(t.key.toUpperCase())}</kbd>`);
const shortcuts = withKeys.length > 1 ? `${withKeys.slice(0, -1).join(' ')} or ${withKeys.at(-1)}` : withKeys.join('');

const html = fill(read(src('index.html')), {
  SITE_NAME: esc(site.name),
  SITE_TITLE: esc(site.title),
  SITE_INTRO: esc(site.intro),
  TOOL_NAMES: esc(tools.map((t) => t.name).join(', ')),
  TOOL_COUNT: String(Math.min(tools.length, 4)),
  CLOCKS: clockHtml,
  TOOLS: cards,
  SHORTCUTS: shortcuts,
  YEAR: String(new Date().getFullYear()),
  VERSION: version,
});

// the list the status checker reads, one URL per line, exactly as the cards use them in data-ping
const statusList = [...new Set(cards.match(/data-ping="[^"]+"/g).map((m) => m.slice(11, -1).replace(/&amp;/g, '&')))].join('\n');

rmSync(join(root, 'dist'), { recursive: true, force: true });
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(out('index.html'), html);
writeFileSync(out('styles.css'), css);
writeFileSync(out('app.js'), js);
copyFileSync(src('favicon.svg'), out('favicon.svg'));
if (existsSync(src('robots.txt'))) copyFileSync(src('robots.txt'), out('robots.txt'));
writeFileSync(join(root, 'dist', 'tools.txt'), `${statusList}\n`);
console.log(`built dist/ with ${tools.length} tools (${tools.map((t) => t.name).join(', ')}), version ${version}`);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// Vertex Pakistan entrypoint: clocks, live status per tool, keyboard shortcuts, call waveforms.
(() => {
  // clocks: each <time data-tz="Area/City"> shows that zone's time
  const clocks = [...document.querySelectorAll('time[data-tz]')].map((el) => ({
    el,
    fmt: new Intl.DateTimeFormat('en-US', { timeZone: el.dataset.tz, hour: 'numeric', minute: '2-digit', hour12: true }),
  }));
  const tick = () => {
    const now = new Date();
    clocks.forEach((c) => (c.el.textContent = c.fmt.format(now)));
  };
  tick();
  setInterval(tick, 15000);
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // live status: the server checks every tool every 30 s and writes status.json (scripts/status-loop.sh)
  const apps = [...document.querySelectorAll('.app[data-ping]')];
  const show = (app, cls, label) => {
    const el = app.querySelector('[data-status]');
    el.className = `status ${cls}`;
    el.querySelector('.status-text').textContent = label;
  };
  const refresh = async () => {
    if (document.visibilityState !== 'visible') return;
    let data = null;
    try {
      const res = await fetch(`status.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) data = await res.json();
    } catch {
      /* shown as unknown below */
    }
    const fresh = data && Date.now() - Date.parse(data.checkedAt) < 3 * 60 * 1000;
    apps.forEach((app) => {
      const s = fresh ? data.tools?.[app.dataset.ping] : null;
      if (!s) show(app, '', 'Status unknown');
      else if (s.up) show(app, 'up', `Online · ${s.ms} ms`);
      else show(app, 'down', s.code ? `Error ${s.code}` : 'Not reachable');
    });
  };
  refresh();
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', refresh);

  // shortcuts: each card's data-key opens it
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const app = apps.find((a) => a.dataset.key === e.key.toLowerCase());
    if (!app) return;
    app.classList.add('pressed');
    app.focus();
    window.location.href = app.href;
  });

  // call previews: a waveform played up to the playhead
  const ns = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('svg[data-wave]').forEach((wave, n) => {
    const bars = 60;
    const w = 240 / bars;
    const played = Math.round(bars * 0.34);
    let seed = 7 + n;
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const rect = (x, y, width, height, cls) => {
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', x.toFixed(2));
      r.setAttribute('y', y.toFixed(2));
      r.setAttribute('width', width.toFixed(2));
      r.setAttribute('height', height.toFixed(2));
      r.setAttribute('rx', '1');
      if (cls) r.setAttribute('class', cls);
      wave.appendChild(r);
    };
    for (let i = 0; i < bars; i++) {
      const env = 0.35 + 0.65 * Math.abs(Math.sin(i / 6.5)) * (i % 17 < 3 ? 0.35 : 1);
      const h = Math.max(3, Math.round(44 * env * (0.45 + 0.55 * rand())));
      rect(i * w + 0.75, (48 - h) / 2, w - 1.5, h, i < played ? 'played' : '');
    }
    rect(played * w - 0.75, 0, 1.5, 48, 'head');
  });
})();

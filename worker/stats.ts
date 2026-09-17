// Self-hosted analytics dashboard, served at /sitevisits.
//
// Public — accessible to anyone who knows the URL, not linked in nav.
// Lists events from KV, aggregates in-memory, renders dark-themed HTML.

import {
  computeStats,
  selectLegacyKeys,
  LIST_LIMIT,
  MAX_LIST_PAGES,
  type Event,
  type Stats,
} from './aggregate';
import type { Env } from './env';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;'
    : c === '<' ? '&lt;'
    : c === '>' ? '&gt;'
    : c === '"' ? '&quot;'
    : '&#39;'
  );

function renderRows(rows: Array<{ key: string; count: number }>, emptyText = 'no data yet'): string {
  if (rows.length === 0) return `<p class="empty">${emptyText}</p>`;
  return `<table>${rows
    .map((r) => `<tr><td class="k">${escapeHtml(r.key)}</td><td class="v">${r.count}</td></tr>`)
    .join('')}</table>`;
}

function renderRecent(events: Event[], n: number): string {
  const sorted = [...events].sort((a, b) => b.ts - a.ts).slice(0, n);
  if (sorted.length === 0) return `<p class="empty">no events yet</p>`;
  const fmt = (ms: number) => {
    const diff = Date.now() - ms;
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
    return `${Math.round(diff / 86_400_000)}d ago`;
  };
  return `<table>${sorted
    .map((e) => {
      const what = e.type === 'click' ? `click ${escapeHtml(e.target ?? '?')}` : escapeHtml(e.path);
      const where = [e.city, e.country].filter(Boolean).join(', ') || '—';
      return `<tr><td class="k">${what}<span class="meta"> · ${escapeHtml(where)}</span></td><td class="v">${fmt(e.ts)}</td></tr>`;
    })
    .join('')}</table>`;
}

function renderHourBars(counts: number[]): string {
  const max = Math.max(...counts, 1);
  return `<div class="hours">${counts
    .map((c, h) => {
      const pct = Math.max(2, Math.round((c / max) * 100));
      return `<div class="hour" title="${h.toString().padStart(2, '0')}:00 UTC · ${c} events"><div class="bar" style="height:${pct}%"></div><span class="hr">${h}</span></div>`;
    })
    .join('')}</div>`;
}

function renderHtml({ events, truncated, legacySkipped }: LoadResult): string {
  const {
    totals, browsers7, hours,
    topSources, topRefs, topClicks, topCountries, topCities, spark, peak,
  }: Stats = computeStats(events);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>sitevisits - bragfile</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; }
  body { min-height: 100dvh; padding: 2rem; }
  .wrap { max-width: 880px; margin: 0 auto; }
  h1 { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 0.25rem; }
  .sub { color: #888; font-size: 0.85rem; margin-bottom: 2rem; }
  .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 2rem; }
  .stat { background: #111; border: 1px solid #1f1f1f; padding: 1rem; border-radius: 8px; }
  .stat .label { color: #888; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat .num { font-size: 1.6rem; font-weight: 600; margin-top: 0.25rem; font-variant-numeric: tabular-nums; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1.25rem; }
  section { background: #111; border: 1px solid #1f1f1f; border-radius: 8px; padding: 1rem 1.25rem; }
  section h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 0.75rem; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  td { padding: 0.35rem 0; border-bottom: 1px solid #1a1a1a; }
  tr:last-child td { border-bottom: none; }
  td.k { color: #ccc; }
  td.v, th.v { color: #888; text-align: right; font-variant-numeric: tabular-nums; padding-left: 1rem; width: 4rem; }
  th.v { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; padding-bottom: 0.5rem; }
  .empty { color: #555; font-size: 0.85rem; font-style: italic; }
  .meta { color: #555; font-size: 0.8rem; }
  .hours { display: flex; align-items: flex-end; gap: 2px; height: 80px; margin-top: 0.25rem; }
  .hour { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
  .hour .bar { background: #6a8caf; width: 100%; border-radius: 2px 2px 0 0; min-height: 2px; opacity: 0.7; transition: opacity 0.2s; }
  .hour:hover .bar { opacity: 1; }
  .hour .hr { color: #555; font-size: 0.6rem; margin-top: 0.25rem; font-variant-numeric: tabular-nums; }
  .spark { font-size: 1.5rem; line-height: 1; letter-spacing: 0; color: #6a8caf; word-break: break-all; }
  .spark-meta { color: #888; font-size: 0.8rem; margin-top: 0.5rem; }
  .foot { margin-top: 2rem; color: #555; font-size: 0.8rem; text-align: center; }
  a { color: #888; text-decoration: underline; text-decoration-color: #333; text-underline-offset: 3px; }
  a:hover { color: #e5e5e5; }
</style>
</head>
<body>
<div class="wrap">
  <h1>stats</h1>
  <p class="sub">first-party analytics for bragfile.jysf.org · <a href="/">home</a></p>

  <div class="totals">
    <div class="stat"><div class="label">unique visitors · 24h</div><div class="num">${totals.uv24}</div></div>
    <div class="stat"><div class="label">unique visitors · 7d</div><div class="num">${totals.uv7}</div></div>
    <div class="stat"><div class="label">pageviews · 24h</div><div class="num">${totals.pv24}</div></div>
    <div class="stat"><div class="label">pageviews · 7d</div><div class="num">${totals.pv7}</div></div>
    <div class="stat"><div class="label">pageviews · 30d</div><div class="num">${totals.pv30}</div></div>
    <div class="stat"><div class="label">clicks · 7d</div><div class="num">${totals.cl7}</div></div>
    <div class="stat"><div class="label">total events</div><div class="num">${totals.all}</div></div>
  </div>

  <section style="margin-bottom: 1.25rem;">
    <h2>pageviews · last 30 days</h2>
    <div class="spark">${spark || '—'}</div>
    <div class="spark-meta">peak day: ${peak}</div>
  </section>

  <section style="margin-bottom: 1.25rem;">
    <h2>hour of day · last 7d (UTC)</h2>
    ${renderHourBars(hours)}
  </section>

  <div class="grid">
    <section>
      <h2>top click targets · 7d</h2>
      ${renderRows(topClicks)}
    </section>
    <section>
      <h2>top referrers · 7d</h2>
      ${renderRows(topRefs, 'no off-site referrers yet')}
    </section>
    <section>
      <h2>top sources · 7d (tagged links, unique)</h2>
      ${renderRows(topSources, 'no tagged links visited yet — try ?source=resume')}
    </section>
    <section>
      <h2>browsers · 7d</h2>
      ${renderRows(browsers7)}
    </section>
    <section>
      <h2>top countries · 7d (unique)</h2>
      ${renderRows(topCountries)}
    </section>
    <section>
      <h2>top cities · 7d (unique)</h2>
      ${renderRows(topCities)}
    </section>
  </div>

  <section style="margin-top: 1.25rem;">
    <h2>recent · last 20 events</h2>
    ${renderRecent(events, 20)}
  </section>

  <p class="foot">no cookies · no third party · 90-day retention · raw events stored in cloudflare kv</p>
  ${truncated || legacySkipped > 0
    ? `<p class="foot">showing a partial window: ${truncated ? `more than ${MAX_LIST_PAGES * LIST_LIMIT} events retained` : ''}${truncated && legacySkipped > 0 ? ' · ' : ''}${legacySkipped > 0 ? `${legacySkipped} pre-metadata events not loaded (they expire within 90 days)` : ''}</p>`
    : ''}
</div>
</body>
</html>`;
}

interface LoadResult {
  events: Event[];
  /** more keys exist than MAX_LIST_PAGES could reach */
  truncated: boolean;
  /** pre-metadata keys we declined to fetch, to stay under the subrequest cap */
  legacySkipped: number;
}

async function loadEvents(env: Env): Promise<LoadResult> {
  const events: Event[] = [];
  const legacyKeys: string[] = [];
  let cursor: string | undefined;
  let complete = false;
  let pagesUsed = 0;

  for (let page = 0; page < MAX_LIST_PAGES && !complete; page++) {
    const res = await env.STATS.list<Event>({ prefix: 'evt:', limit: LIST_LIMIT, cursor });
    pagesUsed++;
    for (const k of res.keys) {
      // The common path: the whole event rode along in the list response.
      if (k.metadata) events.push(k.metadata);
      else legacyKeys.push(k.name);
    }
    if (res.list_complete) complete = true;
    else cursor = res.cursor;
  }

  // Which pre-metadata keys are worth a get(). See selectLegacyKeys: the listing
  // is oldest-first, so this deliberately takes the newest in-window keys.
  const { toFetch, skipped } = selectLegacyKeys(legacyKeys, pagesUsed);
  const values = await Promise.all(toFetch.map((name) => env.STATS.get(name)));
  for (const raw of values) {
    if (!raw) continue;
    try {
      events.push(JSON.parse(raw));
    } catch {
      // skip malformed
    }
  }

  return {
    events,
    truncated: !complete,
    legacySkipped: skipped,
  };
}

export async function handleStatsGet(_request: Request, env: Env): Promise<Response> {
  try {
    const loaded = await loadEvents(env);
    return new Response(renderHtml(loaded), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    // Log the real error server-side for ourselves; show a generic page to viewers
    // so we don't leak internal state.
    console.error('[stats] error rendering dashboard:', err);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>stats unavailable</title>` +
      `<body style="font-family:system-ui;background:#0a0a0a;color:#e5e5e5;padding:2rem">` +
      `<h1>stats temporarily unavailable</h1>` +
      `<p style="color:#888">check back in a minute.</p></body>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

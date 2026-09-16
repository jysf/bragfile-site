// Pure aggregation for the /stats dashboard. No Workers APIs, no I/O, no
// rendering — so it can be unit-tested with a plain test runner.
//
// This module exists because the two bugs that reached production both lived in
// code that could not be tested: the legacy-key selection was inline inside
// loadEvents() (which needs KV) and the daily series was assembled inline inside
// renderHtml() (which returns a 12KB string). Neither was a type error; both
// were arithmetic. Keeping the arithmetic here keeps it reachable from tests.

export interface Event {
  ts: number;
  type: 'pageview' | 'click';
  path: string;
  target?: string;
  referrer?: string;
  country?: string;
  city?: string;
  region?: string;
  ua_family?: string;
  visitor?: string; // daily-rotating hash, see track.ts
  source?: string; // from ?source= or ?utm_source=
  medium?: string; // from ?utm_medium=
}

export const DAY_MS = 86_400_000;

// Cloudflare counts every KV operation as a subrequest and the Workers free plan
// allows 50 per request. The original dashboard ran one get() per key, so it
// began throwing "Too many subrequests" once KV held ~50 events.
export const SUBREQUEST_BUDGET = 45; // margin under the 50 ceiling
export const LIST_LIMIT = 1000; // KV's max page size for list()
export const MAX_LIST_PAGES = 5; // one subrequest each; covers 5000 events
export const MAX_WINDOW_DAYS = 30; // the widest window the dashboard renders

/** Keys are `evt:<ts>:<id>`. Returns NaN for anything else. */
export function tsFromKey(name: string): number {
  return Number(name.split(':')[1]);
}

/**
 * Choose which pre-metadata keys are worth spending a get() on.
 *
 * KV lists lexicographically by UTF-8 bytes, and these keys are timestamp-
 * prefixed, so `keys` arrives OLDEST FIRST and there is no reverse option.
 * Taking the head of that list spends the whole budget on the oldest events on
 * record, which fall outside every window the dashboard renders — the page then
 * comes back empty. Take the newest in-window keys instead.
 */
export function selectLegacyKeys(
  keys: string[],
  pagesUsed: number,
  now = Date.now(),
): { toFetch: string[]; skipped: number } {
  const cutoff = now - MAX_WINDOW_DAYS * DAY_MS;
  const inWindow = keys.filter((name) => {
    const ts = tsFromKey(name);
    return Number.isFinite(ts) && ts >= cutoff;
  });
  const budget = Math.max(0, SUBREQUEST_BUDGET - pagesUsed);
  // slice(-0) returns the whole array, so an exhausted budget must short-circuit.
  const toFetch = budget > 0 ? inWindow.slice(-budget) : [];
  // Only in-window keys count as "skipped". Out-of-window keys could never have
  // been displayed, so reporting them would just alarm the reader for no reason.
  return { toFetch, skipped: inWindow.length - toFetch.length };
}

export function topN<T>(
  items: T[],
  key: (t: T) => string | undefined,
  n: number,
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Group by `key`, then count unique values of `dedupBy` per group. */
export function topUnique<T>(
  items: T[],
  key: (t: T) => string | undefined,
  dedupBy: (t: T) => string | undefined,
  n: number,
): Array<{ key: string; count: number }> {
  const sets = new Map<string, Set<string>>();
  for (const item of items) {
    const k = key(item);
    const d = dedupBy(item);
    if (!k || !d) continue;
    let s = sets.get(k);
    if (!s) {
      s = new Set();
      sets.set(k, s);
    }
    s.add(d);
  }
  return [...sets.entries()]
    .map(([key, s]) => ({ key, count: s.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function uniqueVisitors(events: Event[]): number {
  const s = new Set<string>();
  for (const e of events) if (e.visitor) s.add(e.visitor);
  return s.size;
}

/** Top pages with side-by-side counts for multiple time windows. */
export function topPagesMulti(
  windows: Array<{ label: string; events: Event[] }>,
  n: number,
): { headers: string[]; rows: Array<{ path: string; counts: number[] }> } {
  const allPaths = new Set<string>();
  const perWindow = windows.map((w) => {
    const counts = new Map<string, number>();
    for (const e of w.events) {
      if (e.type !== 'pageview') continue;
      counts.set(e.path, (counts.get(e.path) ?? 0) + 1);
      allPaths.add(e.path);
    }
    return counts;
  });

  const rows = [...allPaths]
    .map((path) => ({ path, counts: perWindow.map((m) => m.get(path) ?? 0) }))
    // sort by the longest window (the rightmost one) for stability
    .sort((a, b) => b.counts[b.counts.length - 1] - a.counts[a.counts.length - 1])
    .slice(0, n);

  return { headers: windows.map((w) => w.label), rows };
}

/** Hour-of-day (0-23 UTC) — returns 24 counts. */
export function hourOfDay(events: Event[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const e of events) {
    const h = new Date(e.ts).getUTCHours();
    buckets[h]++;
  }
  return buckets;
}

export function withinDays(events: Event[], days: number, now = Date.now()): Event[] {
  const cutoff = now - days * DAY_MS;
  return events.filter((e) => e.ts >= cutoff);
}

export function dailySeries(
  events: Event[],
  days: number,
  now = Date.now(),
): Array<{ day: string; count: number }> {
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * DAY_MS);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events) {
    const day = new Date(e.ts).toISOString().slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export function sparkline(series: number[]): string {
  if (series.length === 0) return '';
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const max = Math.max(...series);
  if (max === 0) return chars[0].repeat(series.length);
  return series
    .map((v) => chars[Math.min(chars.length - 1, Math.round((v / max) * (chars.length - 1)))])
    .join('');
}

export interface Stats {
  totals: {
    all: number;
    pv24: number;
    pv7: number;
    pv30: number;
    cl7: number;
    uv24: number;
    uv7: number;
  };
  pagesByWindow: ReturnType<typeof topPagesMulti>;
  topPagesUnique: Array<{ key: string; count: number }>;
  browsers7: Array<{ key: string; count: number }>;
  hours: number[];
  topSources: Array<{ key: string; count: number }>;
  topRefs: Array<{ key: string; count: number }>;
  topClicks: Array<{ key: string; count: number }>;
  topCountries: Array<{ key: string; count: number }>;
  topCities: Array<{ key: string; count: number }>;
  spark: string;
  peak: number;
}

/**
 * Everything the dashboard displays, derived from the raw events. Split out of
 * renderHtml so the numbers can be asserted without parsing HTML.
 */
export function computeStats(events: Event[], now = Date.now()): Stats {
  const last24h = withinDays(events, 1, now);
  const last7d = withinDays(events, 7, now);
  const last30d = withinDays(events, 30, now);

  const pageviews7 = last7d.filter((e) => e.type === 'pageview');
  const clicks7 = last7d.filter((e) => e.type === 'click');

  // NB: last30d already contains the last 7 days. Concatenating pageviews7 onto
  // it double-counts every recent day and inflates the peak. Regression-tested.
  const daily = dailySeries(
    last30d.filter((e) => e.type === 'pageview'),
    30,
    now,
  );
  const series = daily.map((d) => d.count);

  return {
    totals: {
      all: events.length,
      pv24: last24h.filter((e) => e.type === 'pageview').length,
      pv7: pageviews7.length,
      pv30: last30d.filter((e) => e.type === 'pageview').length,
      cl7: clicks7.length,
      uv24: uniqueVisitors(last24h),
      uv7: uniqueVisitors(last7d),
    },
    pagesByWindow: topPagesMulti(
      [
        { label: '24h', events: last24h },
        { label: '7d', events: last7d },
        { label: '30d', events: last30d },
      ],
      15,
    ),
    topPagesUnique: topUnique(pageviews7, (e) => e.path, (e) => e.visitor, 15),
    browsers7: topN(last7d, (e) => e.ua_family, 8),
    hours: hourOfDay(last7d),
    // Tagged-link sources, e.g. ?source=resume. Counted by unique visitors.
    topSources: topUnique(pageviews7, (e) => e.source, (e) => e.visitor, 10),
    topRefs: topN(pageviews7, (e) => e.referrer, 10),
    topClicks: topN(clicks7, (e) => e.target, 15),
    topCountries: topUnique(last7d, (e) => e.country, (e) => e.visitor, 10),
    topCities: topUnique(
      last7d,
      (e) =>
        e.city
          ? `${e.city}${e.region ? ', ' + e.region : ''}${e.country ? ' ' + e.country : ''}`
          : undefined,
      (e) => e.visitor,
      10,
    ),
    spark: sparkline(series),
    peak: Math.max(0, ...series),
  };
}

/**
 * KV caps metadata at 1024 bytes per key. Most fields are length-capped at
 * ingest, but `city` and `region` come from the `cf` object and are not, so a
 * worst case can overflow. An oversized put throws inside waitUntil and drops
 * the event silently, so shed the longest optional fields until it fits. The KV
 * *value* always holds the complete event.
 */
export const METADATA_MAX_BYTES = 1024;

export function fitMetadata(entry: Record<string, unknown>): Record<string, unknown> {
  const meta = { ...entry };
  const bytes = () => new TextEncoder().encode(JSON.stringify(meta)).length;
  for (const field of ['referrer', 'target', 'city', 'region']) {
    if (bytes() <= METADATA_MAX_BYTES) break;
    delete meta[field];
  }
  return meta;
}

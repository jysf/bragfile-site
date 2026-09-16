// Unit tests for the /stats aggregation logic.
//
// These exist because two bugs reached production in a row, and neither was a
// type error — both were arithmetic in code that had no test. Every test below
// named "regression" corresponds to something that actually broke live.
//
// Pure functions only: no browser, no server, no KV.
//
// Runs on `node --test` with type stripping (Node 22) — same assertions as the
// jy7y Playwright suite, minus the browser dependency this repo doesn't carry.

import { test, expect } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStats,
  selectLegacyKeys,
  fitMetadata,
  dailySeries,
  topN,
  topUnique,
  sparkline,
  tsFromKey,
  withinDays,
  DAY_MS,
  SUBREQUEST_BUDGET,
  type Event,
} from '../functions/stats/aggregate';

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0); // fixed clock so nothing is flaky

function pv(daysAgo: number, path = '/', visitor = 'v1'): Event {
  return { ts: NOW - daysAgo * DAY_MS, type: 'pageview', path, visitor };
}

test.describe('selectLegacyKeys', () => {
  // KV lists lexicographically and the keys are timestamp-prefixed, so the
  // listing arrives oldest-first. Taking the head spent the whole budget on
  // ~90-day-old events, outside every window the page renders. Page came back
  // empty. Shipped as #55, fixed in #57.
  test('regression: takes the NEWEST in-window keys, not the oldest', () => {
    const keys: string[] = [];
    for (let i = 500; i >= 1; i--) keys.push(`evt:${NOW - i * ((90 * DAY_MS) / 500)}:k${i}`);

    const { toFetch } = selectLegacyKeys(keys, 1, NOW);
    const ages = toFetch.map((k) => (NOW - tsFromKey(k)) / DAY_MS);

    expect(toFetch.length).toBeGreaterThan(0);
    // every fetched key must be inside the 30-day window
    expect(Math.max(...ages)).toBeLessThan(30);
    // and the newest key overall must be included
    expect(toFetch).toContain(keys[keys.length - 1]);
  });

  test('drops keys outside the 30-day render window', () => {
    const keys = [`evt:${NOW - 60 * DAY_MS}:old`, `evt:${NOW - 2 * DAY_MS}:new`];
    const { toFetch } = selectLegacyKeys(keys, 1, NOW);
    expect(toFetch).toEqual([`evt:${NOW - 2 * DAY_MS}:new`]);
  });

  // slice(-0) returns the ENTIRE array. With no budget left that would fan out
  // one get() per key and reproduce the original subrequest blowout.
  test('regression: exhausted budget fetches nothing, not everything', () => {
    const keys = Array.from({ length: 200 }, (_, i) => `evt:${NOW - i * 1000}:k${i}`);
    const { toFetch } = selectLegacyKeys(keys, SUBREQUEST_BUDGET, NOW);
    expect(toFetch).toEqual([]);
  });

  test('never exceeds the remaining subrequest budget', () => {
    const keys = Array.from({ length: 500 }, (_, i) => `evt:${NOW - i * 1000}:k${i}`);
    for (const pagesUsed of [1, 3, 5]) {
      const { toFetch } = selectLegacyKeys(keys, pagesUsed, NOW);
      expect(toFetch.length).toBeLessThanOrEqual(SUBREQUEST_BUDGET - pagesUsed);
    }
  });

  test('reports skipped in-window keys, ignoring out-of-window ones', () => {
    const recent = Array.from({ length: 100 }, (_, i) => `evt:${NOW - i * 1000}:r${i}`);
    const ancient = Array.from({ length: 50 }, (_, i) => `evt:${NOW - (60 + i) * DAY_MS}:a${i}`);
    const { toFetch, skipped } = selectLegacyKeys([...ancient, ...recent], 1, NOW);
    expect(skipped).toBe(100 - toFetch.length); // the 50 ancient ones are not counted
  });

  test('ignores malformed keys rather than throwing', () => {
    const { toFetch } = selectLegacyKeys(['evt:notanumber:x', 'garbage', `evt:${NOW}:ok`], 1, NOW);
    expect(toFetch).toEqual([`evt:${NOW}:ok`]);
  });
});

test.describe('computeStats', () => {
  // The 30-day series was fed pageviews7.concat(last30d pageviews), but
  // last30d already contains those 7 days, so every recent day counted twice
  // and the peak was inflated. Shipped, fixed in #55.
  test('regression: does not double-count recent days in the sparkline', () => {
    const events = Array.from({ length: 60 }, () => pv(0));
    const { peak, totals } = computeStats(events, NOW);
    expect(totals.pv30).toBe(60);
    expect(peak).toBe(60); // was 120 with the concat bug
  });

  test('windows nest correctly: 24h <= 7d <= 30d', () => {
    const events = [pv(0), pv(3), pv(10), pv(45)];
    const { totals } = computeStats(events, NOW);
    expect(totals.pv24).toBe(1);
    expect(totals.pv7).toBe(2);
    expect(totals.pv30).toBe(3); // the 45-day-old one falls outside every window
    expect(totals.all).toBe(4); // but still counts toward the raw total
  });

  test('unique visitors dedupe within a window', () => {
    const events = [pv(0, '/', 'a'), pv(0, '/', 'a'), pv(0, '/', 'b')];
    const { totals } = computeStats(events, NOW);
    expect(totals.pv24).toBe(3);
    expect(totals.uv24).toBe(2);
  });

  test('separates pageviews from clicks', () => {
    const events: Event[] = [
      pv(1),
      { ts: NOW - DAY_MS, type: 'click', path: '/', target: 'github-footer', visitor: 'a' },
    ];
    const { totals, topClicks } = computeStats(events, NOW);
    expect(totals.pv7).toBe(1);
    expect(totals.cl7).toBe(1);
    expect(topClicks).toEqual([{ key: 'github-footer', count: 1 }]);
  });

  test('handles an empty event list without throwing', () => {
    const s = computeStats([], NOW);
    expect(s.totals.all).toBe(0);
    expect(s.peak).toBe(0);
    expect(s.spark).toHaveLength(30); // all-zero series still renders 30 bars
  });
});

test.describe('helpers', () => {
  test('withinDays is inclusive of the cutoff boundary', () => {
    const onBoundary = { ts: NOW - 7 * DAY_MS, type: 'pageview', path: '/' } as Event;
    expect(withinDays([onBoundary], 7, NOW)).toHaveLength(1);
  });

  test('dailySeries returns one bucket per day, oldest first', () => {
    const series = dailySeries([pv(0), pv(0), pv(1)], 30, NOW);
    expect(series).toHaveLength(30);
    expect(series[29].count).toBe(2); // today
    expect(series[28].count).toBe(1); // yesterday
    expect(series[0].day < series[29].day).toBe(true);
  });

  test('topN sorts by count descending and respects the limit', () => {
    const items = [{ k: 'a' }, { k: 'b' }, { k: 'b' }, { k: 'c' }, { k: 'c' }, { k: 'c' }];
    expect(topN(items, (i) => i.k, 2)).toEqual([
      { key: 'c', count: 3 },
      { key: 'b', count: 2 },
    ]);
  });

  test('topUnique counts distinct visitors, not raw events', () => {
    const items = [
      { p: '/a', v: 'x' },
      { p: '/a', v: 'x' },
      { p: '/a', v: 'y' },
    ];
    expect(topUnique(items, (i) => i.p, (i) => i.v, 5)).toEqual([{ key: '/a', count: 2 }]);
  });

  test('sparkline scales to the max and survives an all-zero series', () => {
    expect(sparkline([0, 0, 0])).toBe('▁▁▁');
    expect(sparkline([0, 10])).toBe('▁█');
    expect(sparkline([])).toBe('');
  });
});

test.describe('fitMetadata', () => {
  test('leaves a normal event untouched', () => {
    const entry = { ts: NOW, type: 'pageview', path: '/about', visitor: 'abc123' };
    expect(fitMetadata(entry)).toEqual(entry);
  });

  // city/region come from the cf object and have no length cap at ingest, unlike
  // every other field. An oversized put throws inside waitUntil and silently
  // drops the event.
  test('sheds optional fields until it fits under the 1024-byte KV cap', () => {
    const entry = {
      ts: NOW,
      type: 'pageview',
      path: '/' + 'p'.repeat(199),
      referrer: 'https://example.com/' + 'r'.repeat(180),
      target: 't'.repeat(100),
      city: 'c'.repeat(400),
      region: 'g'.repeat(400),
      visitor: 'abc123',
    };
    const fitted = fitMetadata(entry);
    expect(new TextEncoder().encode(JSON.stringify(fitted)).length).toBeLessThanOrEqual(1024);
    // the identifying fields survive the trim
    expect(fitted.ts).toBe(NOW);
    expect(fitted.path).toBe(entry.path);
    expect(fitted.visitor).toBe('abc123');
  });
});

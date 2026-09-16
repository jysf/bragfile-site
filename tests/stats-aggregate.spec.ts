// Unit tests for the /stats aggregation logic.
//
// These exist because two bugs reached production in a row, and neither was a
// type error — both were arithmetic in code that had no test. Every test below
// named "regression" corresponds to something that actually broke live on
// jysf.org.
//
// Pure functions only: no browser, no server, no KV. Runs on `node --test`
// with type stripping (Node 22) so the repo needs no test-runner dependency.

import { test } from 'node:test';
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
} from '../worker/aggregate.ts';

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0); // fixed clock so nothing is flaky

function pv(daysAgo: number, path = '/', visitor = 'v1'): Event {
  return { ts: NOW - daysAgo * DAY_MS, type: 'pageview', path, visitor };
}

// KV lists lexicographically and the keys are timestamp-prefixed, so the
// listing arrives oldest-first. Taking the head spent the whole budget on
// ~90-day-old events, outside every window the page renders. Page came back
// empty on jysf.org.
test('selectLegacyKeys: regression, takes the NEWEST in-window keys, not the oldest', () => {
  const keys: string[] = [];
  for (let i = 500; i >= 1; i--) keys.push(`evt:${NOW - i * ((90 * DAY_MS) / 500)}:k${i}`);

  const { toFetch } = selectLegacyKeys(keys, 1, NOW);
  const ages = toFetch.map((k) => (NOW - tsFromKey(k)) / DAY_MS);

  assert.ok(toFetch.length > 0);
  // every fetched key must be inside the 30-day window
  assert.ok(Math.max(...ages) < 30);
  // and the newest key overall must be included
  assert.ok(toFetch.includes(keys[keys.length - 1]));
});

test('selectLegacyKeys: drops keys outside the 30-day render window', () => {
  const keys = [`evt:${NOW - 60 * DAY_MS}:old`, `evt:${NOW - 2 * DAY_MS}:new`];
  const { toFetch } = selectLegacyKeys(keys, 1, NOW);
  assert.deepEqual(toFetch, [`evt:${NOW - 2 * DAY_MS}:new`]);
});

// slice(-0) returns the ENTIRE array. With no budget left that would fan out
// one get() per key and reproduce the original subrequest blowout.
test('selectLegacyKeys: regression, exhausted budget fetches nothing, not everything', () => {
  const keys = Array.from({ length: 200 }, (_, i) => `evt:${NOW - i * 1000}:k${i}`);
  const { toFetch } = selectLegacyKeys(keys, SUBREQUEST_BUDGET, NOW);
  assert.deepEqual(toFetch, []);
});

test('selectLegacyKeys: never exceeds the remaining subrequest budget', () => {
  const keys = Array.from({ length: 500 }, (_, i) => `evt:${NOW - i * 1000}:k${i}`);
  for (const pagesUsed of [1, 3, 5]) {
    const { toFetch } = selectLegacyKeys(keys, pagesUsed, NOW);
    assert.ok(toFetch.length <= SUBREQUEST_BUDGET - pagesUsed);
  }
});

test('selectLegacyKeys: reports skipped in-window keys, ignoring out-of-window ones', () => {
  const recent = Array.from({ length: 100 }, (_, i) => `evt:${NOW - i * 1000}:r${i}`);
  const ancient = Array.from({ length: 50 }, (_, i) => `evt:${NOW - (60 + i) * DAY_MS}:a${i}`);
  const { toFetch, skipped } = selectLegacyKeys([...ancient, ...recent], 1, NOW);
  assert.equal(skipped, 100 - toFetch.length); // the 50 ancient ones are not counted
});

test('selectLegacyKeys: ignores malformed keys rather than throwing', () => {
  const { toFetch } = selectLegacyKeys(['evt:notanumber:x', 'garbage', `evt:${NOW}:ok`], 1, NOW);
  assert.deepEqual(toFetch, [`evt:${NOW}:ok`]);
});

// The 30-day series was fed pageviews7.concat(last30d pageviews), but
// last30d already contains those 7 days, so every recent day counted twice
// and the peak was inflated.
test('computeStats: regression, does not double-count recent days in the sparkline', () => {
  const events = Array.from({ length: 60 }, () => pv(0));
  const { peak, totals } = computeStats(events, NOW);
  assert.equal(totals.pv30, 60);
  assert.equal(peak, 60); // was 120 with the concat bug
});

test('computeStats: windows nest correctly, 24h <= 7d <= 30d', () => {
  const events = [pv(0), pv(3), pv(10), pv(45)];
  const { totals } = computeStats(events, NOW);
  assert.equal(totals.pv24, 1);
  assert.equal(totals.pv7, 2);
  assert.equal(totals.pv30, 3); // the 45-day-old one falls outside every window
  assert.equal(totals.all, 4); // but still counts toward the raw total
});

test('computeStats: unique visitors dedupe within a window', () => {
  const events = [pv(0, '/', 'a'), pv(0, '/', 'a'), pv(0, '/', 'b')];
  const { totals } = computeStats(events, NOW);
  assert.equal(totals.pv24, 3);
  assert.equal(totals.uv24, 2);
});

test('computeStats: separates pageviews from clicks', () => {
  const events: Event[] = [
    pv(1),
    { ts: NOW - DAY_MS, type: 'click', path: '/', target: 'github-footer', visitor: 'a' },
  ];
  const { totals, topClicks } = computeStats(events, NOW);
  assert.equal(totals.pv7, 1);
  assert.equal(totals.cl7, 1);
  assert.deepEqual(topClicks, [{ key: 'github-footer', count: 1 }]);
});

test('computeStats: handles an empty event list without throwing', () => {
  const s = computeStats([], NOW);
  assert.equal(s.totals.all, 0);
  assert.equal(s.peak, 0);
  assert.equal(s.spark.length, 30); // all-zero series still renders 30 bars
});

test('withinDays is inclusive of the cutoff boundary', () => {
  const onBoundary = { ts: NOW - 7 * DAY_MS, type: 'pageview', path: '/' } as Event;
  assert.equal(withinDays([onBoundary], 7, NOW).length, 1);
});

test('dailySeries returns one bucket per day, oldest first', () => {
  const series = dailySeries([pv(0), pv(0), pv(1)], 30, NOW);
  assert.equal(series.length, 30);
  assert.equal(series[29].count, 2); // today
  assert.equal(series[28].count, 1); // yesterday
  assert.ok(series[0].day < series[29].day);
});

test('topN sorts by count descending and respects the limit', () => {
  const items = [{ k: 'a' }, { k: 'b' }, { k: 'b' }, { k: 'c' }, { k: 'c' }, { k: 'c' }];
  assert.deepEqual(topN(items, (i) => i.k, 2), [
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
  assert.deepEqual(topUnique(items, (i) => i.p, (i) => i.v, 5), [{ key: '/a', count: 2 }]);
});

test('sparkline scales to the max and survives an all-zero series', () => {
  assert.equal(sparkline([0, 0, 0]), '▁▁▁');
  assert.equal(sparkline([0, 10]), '▁█');
  assert.equal(sparkline([]), '');
});

test('fitMetadata leaves a normal event untouched', () => {
  const entry = { ts: NOW, type: 'pageview', path: '/about', visitor: 'abc123' };
  assert.deepEqual(fitMetadata(entry), entry);
});

// city/region come from the cf object and have no length cap at ingest, unlike
// every other field. An oversized put throws inside waitUntil and silently
// drops the event.
test('fitMetadata sheds optional fields until it fits under the 1024-byte KV cap', () => {
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
  assert.ok(new TextEncoder().encode(JSON.stringify(fitted)).length <= 1024);
  // the identifying fields survive the trim
  assert.equal(fitted.ts, NOW);
  assert.equal(fitted.path, entry.path);
  assert.equal(fitted.visitor, 'abc123');
});

import { fitMetadata } from './aggregate';
import type { Env } from './env';

// Ingest endpoint for first-party analytics.
//
// Receives a JSON body from the in-page beacon and writes one event to KV.
// Privacy: no IP stored, no full UA stored, coarse UA family only, 90-day TTL.
//
// Notes:
//   - KV write is fired via ctx.waitUntil so the beacon response returns
//     immediately (204), keeping the client-side beacon cheap.
//   - The 405 for non-POST methods is answered by worker/index.ts.

const VALID_TYPES = new Set(['pageview', 'click']);
const MAX_PATH_LEN = 200;
const MAX_TARGET_LEN = 100;
const MAX_REFERRER_LEN = 200;
const MAX_SOURCE_LEN = 50;
const RETENTION_SECONDS = 60 * 60 * 24 * 90; // 90 days
const MAX_BODY_BYTES = 4 * 1024; // hard cap on the beacon payload


// Origins we accept beacons from. Same-origin requests from the browser will
// send an Origin header matching one of these. Requests with no Origin
// (e.g. curl, server-to-server) are rejected outright.
// Production origin only: preview versions run with the same STATS binding,
// so allowing *.workers.dev preview URLs would write preview traffic into
// production numbers.
const ALLOWED_ORIGINS = new Set([
  'https://bragfile.jysf.org',
]);

// Order matters: Edge identifies as Chrome, so detect "edg/" first.
const UA_FAMILIES: Array<{ family: string; needle: string }> = [
  { family: 'edge', needle: 'edg/' },
  { family: 'chrome', needle: 'chrome/' },
  { family: 'firefox', needle: 'firefox/' },
  { family: 'safari', needle: 'safari/' },
];

function uaFamily(ua: string | null): string {
  if (!ua) return 'other';
  const lower = ua.toLowerCase();
  for (const { family, needle } of UA_FAMILIES) {
    if (lower.includes(needle)) return family;
  }
  return 'other';
}

function trim(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v) return undefined;
  return v.length > max ? v.slice(0, max) : v;
}

// Privacy-friendly unique-visitor id.
//
// Hash of (daily-rotating salt + site host + IP + User-Agent). The salt is
// the current UTC date, so the same visitor gets a different hash each day —
// no cross-day tracking is possible. Raw IP is not stored anywhere.
//
// This is the same pattern Plausible / Fathom use.
async function visitorHash(
  request: Request,
  seed: string | undefined,
): Promise<string> {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const ua = request.headers.get('User-Agent') ?? '';
  const host = new URL(request.url).host;
  const input = `${seed ?? 'bragfile-default-seed'}|${day}|${host}|${ip}|${ua}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  // 12 hex chars = 48 bits of entropy — collision-resistant at any realistic
  // personal-site scale and small enough to keep KV values tidy.
  return [...new Uint8Array(buf)]
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeReferrer(value: unknown, selfHost: string): string | undefined {
  const ref = trim(value, MAX_REFERRER_LEN);
  if (!ref) return undefined;
  try {
    const url = new URL(ref);
    if (url.host === selfHost) return undefined; // same-origin = not interesting
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export async function handleTrackPost(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  // Reject requests not coming from a browser tab on our domain.
  // This won't stop a determined attacker (Origin is forgeable from non-browser
  // clients), but it stops drive-by curl scripts from filling our KV quota.
  const origin = request.headers.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response('forbidden', { status: 403 });
  }

  // Cap body size before parsing JSON
  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response('payload too large', { status: 413 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  if (!body || !VALID_TYPES.has(body.type)) {
    return new Response('bad type', { status: 400 });
  }

  const path = trim(body.path, MAX_PATH_LEN);
  if (!path || !path.startsWith('/')) {
    return new Response('bad path', { status: 400 });
  }

  const cf = (request as any).cf ?? {};
  const ts = Date.now();
  const id = crypto.randomUUID().slice(0, 6);
  const visitor = await visitorHash(request, env.VISITOR_SALT_SEED);

  const entry: Record<string, unknown> = {
    ts,
    type: body.type,
    path,
    target: trim(body.target, MAX_TARGET_LEN),
    referrer: normalizeReferrer(body.referrer, new URL(request.url).host),
    source: trim(body.source, MAX_SOURCE_LEN),
    medium: trim(body.medium, MAX_SOURCE_LEN),
    country: request.headers.get('CF-IPCountry') ?? undefined,
    city: typeof cf.city === 'string' ? cf.city : undefined,
    region: typeof cf.region === 'string' ? cf.region : undefined,
    ua_family: uaFamily(request.headers.get('User-Agent')),
    visitor,
  };

  // Drop undefined keys so the KV value stays tidy
  for (const k of Object.keys(entry)) {
    if (entry[k] === undefined) delete entry[k];
  }

  // Fire-and-forget the KV write — response returns 204 immediately.
  // waitUntil keeps the Worker alive until the put resolves.
  ctx.waitUntil(
    env.STATS.put(`evt:${ts}:${id}`, JSON.stringify(entry), {
      expirationTtl: RETENTION_SECONDS,
      metadata: fitMetadata(entry),
    })
  );

  return new Response(null, { status: 204 });
}

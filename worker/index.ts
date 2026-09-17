// bragfile-site Cloudflare Worker entry point.
//
// The site is served by the Worker `bragfile` (deployed from GitHub via
// Workers Builds) with static assets. The analytics code was first written as
// Pages Functions, which Cloudflare Workers ignore entirely — that's why
// routing is manual here:
//
//   POST /api/track    -> event ingest (worker/track.ts)
//   GET  /sitevisits   -> analytics dashboard (worker/stats.ts)
//   everything else    -> falls through to the static assets in dist/
//
// `run_worker_first` in wrangler.jsonc ensures these paths actually reach the
// Worker instead of being answered by the asset server first.

import { handleTrackPost } from './track';
import { handleStatsGet } from './stats';
import type { Env } from './env';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/track') {
      if (request.method === 'POST') return handleTrackPost(request, env, ctx);
      return new Response(`method ${request.method} not allowed`, {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }

    if (url.pathname === '/sitevisits' || url.pathname === '/sitevisits/') {
      if (request.method === 'GET') return handleStatsGet(request, env);
      return new Response(`method ${request.method} not allowed`, {
        status: 405,
        headers: { Allow: 'GET' },
      });
    }

    // Fall through to static assets (configured via the assets binding).
    return env.ASSETS.fetch(request);
  },
};

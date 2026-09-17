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

    // Fall through to static assets. If nothing matches (unknown path),
    // redirect to the home page — this site is one page, so a 404 page adds
    // nothing. /404.html (the asset server's not-found response) also goes
    // home rather than rendering a second page.
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status === 404) {
      return Response.redirect(new URL('/', url).toString(), 302);
    }
    return assetRes;
  },
};

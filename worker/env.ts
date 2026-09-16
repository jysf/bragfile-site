// Shared Worker environment bindings. Single source of truth — track.ts,
// stats.ts and index.ts all import this.
export interface Env {
  // KV namespace holding raw analytics events (`evt:<ts>:<id>`).
  STATS: KVNamespace;
  // Static-asset binding from wrangler.jsonc ("assets"."binding"). Used to
  // fall through to dist/ for every path the Worker doesn't handle itself.
  ASSETS: Fetcher;
  // Optional: a secret string prepended to the daily salt to make the visitor
  // hash harder to brute-force back to an IP. Already set as a secret on the
  // `bragfile` Worker in the Cloudflare dashboard. If unset, falls back to a
  // hardcoded constant — still privacy-safe, just less paranoid.
  VISITOR_SALT_SEED?: string;
}

// Writes the current build's commit SHA to src/data/build.json so the
// Astro frontmatter can read it as a static read at build time. Runs as
// part of `npm run build` (chained before `astro build`).
//
// Sources, in order:
//  1. CF_PAGES_COMMIT_SHA env var (Cloudflare Pages sets this automatically
//     on every production build — CF_PAGES_BRANCH is also set if you want
//     to record which branch).
//  2. CI_COMMIT_SHA / COMMIT_SHA (other CI hosts).
//  3. git rev-parse --short HEAD (works on any host with git, and as a
//     fallback inside the CF Pages build container if the env vars aren't
//     reaching the npm-script context — which earlier testing showed).
//
// Falls back to "dev" if nothing works (so the stamp still renders).

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function shortSha() {
  const env =
    process.env.CF_PAGES_COMMIT_SHA ??
    process.env.CI_COMMIT_SHA ??
    process.env.COMMIT_SHA;
  if (env && env.length >= 7) return env.slice(0, 7);

  try {
    const out = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {
    // no git in PATH
  }
  return "dev";
}

const sha = shortSha();
const out = {
  sha,
  branch: process.env.CF_PAGES_BRANCH ?? process.env.CI_BRANCH ?? process.env.GITHUB_REF_NAME ?? null,
  builtAt: new Date().toISOString(),
};

const dest = "src/data/build.json";
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${dest} (sha=${sha})`);
// Writes the current git commit's short SHA to src/data/build.json so the
// Astro frontmatter can read it as a static import. Runs as part of
// `npm run build` (chained before `astro build`). At Cloudflare Pages
// build time, this fires inside the build container where `git` is
// available, so it doesn't depend on CF_PAGES_COMMIT_SHA env var
// propagation — which, in this project's testing, isn't reaching the
// npm-script context reliably.

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function shortSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // No git available (CI sandbox, container without git, etc.).
    return "dev";
  }
}

const sha = shortSha();
const out = { sha, builtAt: new Date().toISOString() };

const dest = "src/data/build.json";
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${dest} (sha=${sha})`);
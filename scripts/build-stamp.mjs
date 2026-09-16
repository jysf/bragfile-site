// Build stamp — runs as a Vite plugin inside `astro build`. Writes the
// current build's commit SHA to src/data/build.json so the Astro
// frontmatter can read it as a static file.
//
// Lives in astro.config.mjs as a plugin rather than a separate `npm run`
// step so it runs even when CF Pages (or any host) calls `astro build`
// directly without going through the npm script chain.
//
// Sources, in order:
//  1. CF_PAGES_COMMIT_SHA env var (Cloudflare Pages sets this
//     automatically on every production build; CF_PAGES_BRANCH also set)
//  2. CI_COMMIT_SHA / COMMIT_SHA (other CI hosts)
//  3. git rev-parse --short HEAD (any host with git available)
//  4. "dev"

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

function resolveSha() {
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

function resolveBranch() {
  return (
    process.env.CF_PAGES_BRANCH ??
    process.env.CI_BRANCH ??
    process.env.GITHUB_REF_NAME ??
    null
  );
}

export default function buildStampPlugin() {
  return {
    name: "bragfile:build-stamp",
    enforce: "pre",
    buildStart() {
      const sha = resolveSha();
      const branch = resolveBranch();
      const out = {
        sha,
        branch,
        builtAt: new Date().toISOString(),
      };

      const dest = "src/data/build.json";
      if (!existsSync("src")) {
        mkdirSync("src", { recursive: true });
      }
      writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
      // eslint-disable-next-line no-console
      console.log(`[build-stamp] wrote ${dest} (sha=${sha})`);
    },
  };
}
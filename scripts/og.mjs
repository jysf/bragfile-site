// Generates public/og.png from src/data/log.json.
// Run: node scripts/og.mjs   (after `npm run log`)
//
// Why this exists: the social card shows real numbers from the real log,
// so the link preview is itself evidence. Regenerate at freeze time.

import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const entries = JSON.parse(readFileSync("src/data/log.json", "utf8"));

// Bucket entries into 8 columns across the span of the log.
const times = entries
  .map((e) => Date.parse(e.created_at ?? e.date))
  .sort((a, b) => a - b);
const [lo, hi] = [times[0], times.at(-1)];
const buckets = new Array(8).fill(0);
for (const t of times) {
  const i = hi === lo ? 7 : Math.min(7, Math.floor(((t - lo) / (hi - lo)) * 8));
  buckets[i]++;
}
const peak = Math.max(...buckets, 1);

const barW = 44, gap = 12, baseY = 500, maxH = 180;
const bars = buckets
  .map((n, i) => {
    const h = Math.max(6, Math.round((n / peak) * maxH));
    const x = 80 + i * (barW + gap);
    return `<rect x="${x}" y="${baseY - h}" width="${barW}" height="${h}" fill="#ffffff"/>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#282c34"/>
  <rect x="0" y="0" width="1200" height="8" fill="#e04e1b"/>
  <text x="80" y="130" font-family="sans-serif" font-size="64" font-weight="600" fill="#dce1e6">bragfile</text>
  <text x="80" y="190" font-family="monospace" font-size="26" fill="#8a9199">${entries.length} entries · captured live · never reconstructed</text>
  ${bars}
  <text x="80" y="560" font-family="monospace" font-size="22" fill="#8a9199">brew install jysf/tap/bragfile</text>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
  .render()
  .asPng();
writeFileSync("public/og.png", png);
console.log(`wrote public/og.png (${entries.length} entries)`);

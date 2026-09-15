// Generates public/hero.apng — animated showcase image used in the page
// hero and as the terminaltrove.com submission image. Run: just hero
//
// The animation: a stylized terminal panel of `brag spark --week` output,
// with the pulse bars growing from zero to full height, holding, then
// looping. Text is static. Same data as scripts/og.mjs but rendered as
// motion so the hero reads at a glance and the terminaltrove preview
// shows the tool in action.

import { Resvg } from "@resvg/resvg-js";
import UPNG from "upng-js";
import { readFileSync, writeFileSync } from "node:fs";

const entries = JSON.parse(readFileSync("src/data/log.json", "utf8"));

// Pulse: bucket entries across 8 columns spanning the log's date range.
const times = entries
  .map((e) => Date.parse(e.created_at ?? e.date))
  .filter((t) => Number.isFinite(t))
  .sort((a, b) => a - b);
const buckets = new Array(8).fill(0);
if (times.length > 0) {
  const lo = times[0];
  const hi = times.at(-1);
  for (const t of times) {
    const i = hi === lo
      ? 7
      : Math.min(7, Math.floor(((t - lo) / (hi - lo)) * 8));
    buckets[i]++;
  }
}
const peak = Math.max(...buckets, 1);

// Layout constants. Image is 1200×630 — matches the OG card slot so the
// same render works for social previews, terminaltrove, and the page hero.
const W = 1200;
const H = 630;
const PANEL_X = 80;
const PANEL_Y = 180;
const PANEL_W = W - PANEL_X * 2;
const PANEL_H = 380;

const BAR_W = 28;
const BAR_GAP = 8;
const BAR_MAX_H = 110;
const BAR_X_START = PANEL_X + 24;
const BAR_Y_BASE = PANEL_Y + PANEL_H - 28;

// Animation: 30 frames over ~2.1s. Last 8 frames hold the final state so
// the bars are readable before the loop restarts.
const FRAMES = 30;
const FRAME_DELAY_MS = 70;

const generatedAt = new Date().toISOString();

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function frameSvg(frameIdx) {
  // t in 0..1 — bars reach full height by frame (FRAMES - holdFrames).
  const HOLD = 8;
  const growFrames = FRAMES - HOLD;
  const t = frameIdx < growFrames ? frameIdx / (growFrames - 1) : 1;

  // Bar heights interpolated by t.
  const barHeights = buckets.map((n) => {
    const target = Math.max(3, Math.round((n / peak) * BAR_MAX_H));
    return Math.max(1, Math.round(target * t));
  });

  // Build the bar rectangles.
  const bars = barHeights
    .map((h, i) => {
      const x = BAR_X_START + i * (BAR_W + BAR_GAP);
      const y = BAR_Y_BASE - h;
      return `<rect x="${x}" y="${y}" width="${BAR_W}" height="${h}" fill="#ffffff"/>`;
    })
    .join("");

  // Build the static output lines.
  const lines = [
    ["# Bragfile Spark", "#ffffff"],
    [`Generated: ${generatedAt}`, "#8a9199"],
    ["Scope: week", "#8a9199"],
    ["Filters: (none)", "#8a9199"],
    [`Entries: ${entries.length}`, "#8a9199"],
    ["", "#8a9199"],
    ["## Pulse", "#ffffff"],
    ["", "#8a9199"],
    [`Total (${entries.length}):`, "#ffffff"],
  ];
  const text = lines
    .map(([s, fill], i) =>
      `<text x="${PANEL_X + 24}" y="${PANEL_Y + 56 + i * 26}" ` +
      `font-family="monospace" font-size="22" fill="${fill}">` +
      `${escapeXml(s)}</text>`
    )
    .join("");

  // Pulse label is drawn just above the bar baseline so the bars align
  // with their row label visually.
  const barsRowY = BAR_Y_BASE + 18;
  const pulseLabel = `<text x="${PANEL_X + 24}" y="${barsRowY}" ` +
    `font-family="monospace" font-size="22" fill="#8a9199">` +
    `Pulse (8 buckets across the log):</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#282c34"/>
    <rect x="0" y="0" width="${W}" height="8" fill="#e04e1b"/>

    <text x="80" y="100" font-family="sans-serif" font-size="64" font-weight="600" fill="#dce1e6">bragfile</text>
    <text x="80" y="140" font-family="monospace" font-size="22" fill="#8a9199">the flight recorder for your work</text>

    <rect x="${PANEL_X}" y="${PANEL_Y}" width="${PANEL_W}" height="${PANEL_H}" fill="#1f2329"/>

    <text x="${PANEL_X + 24}" y="${PANEL_Y + 36}" font-family="monospace" font-size="20" fill="#8a9199">$ brag spark --week</text>

    ${text}
    ${pulseLabel}
    ${bars}

    <text x="80" y="${H - 30}" font-family="monospace" font-size="22" fill="#8a9199">brew install jysf/tap/bragfile</text>
  </svg>`;
}

// Render each frame to RGBA via resvg → PNG bytes → UPNG.toRGBA8 →
// ArrayBuffer, then assemble into APNG. UPNG.decode's `data` field
// includes per-row PNG filter bytes (=> byteLength is W*H*4 + H), so
// we use toRGBA8 which strips those and gives a clean W*H*4 buffer.
const frames = [];
for (let f = 0; f < FRAMES; f++) {
  const svg = frameSvg(f);
  const pngBytes = new Resvg(svg, { fitTo: { mode: "width", value: W } })
    .render()
    .asPng();
  const rgbaBuffers = UPNG.toRGBA8(UPNG.decode(pngBytes));
  // Each frame is an ArrayBuffer; wrap in Uint8Array for UPNG.encode.
  frames.push(new Uint8Array(rgbaBuffers[0]));
}

const delays = new Array(FRAMES).fill(FRAME_DELAY_MS);
// UPNG.encode(bufs, w, h, ps, dels, forbidPlte). We pass forbidPlte=true
// to force RGBA output — without it UPNG auto-quantizes to a 1-bit
// palette and the bars look like solid rectangles, no antialiasing.
const apng = UPNG.encode(frames, W, H, 0, delays, true);
writeFileSync("public/hero.apng", Buffer.from(apng));

const apngBuf = Buffer.from(apng);
console.log(
  `wrote public/hero.apng (${FRAMES} frames, ` +
    `${(apngBuf.byteLength / 1024).toFixed(1)}KB, ` +
    `${(FRAME_DELAY_MS * FRAMES / 1000).toFixed(1)}s loop)`
);

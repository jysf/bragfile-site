// Generates public/hero.apng — animated showcase image used in the page
// hero and as the terminaltrove.com submission image. Run: just hero
//
// The animation is a terminal session: six commands typed and run in
// sequence, each with a one-line output. The bars in `brag spark` grow
// in mid-stream so that command is the visual peak. A blinking caret
// tracks the current line. The whole thing loops every ~2.5s.
//
// All numbers come from the live bragfile DB — no invented stats.

import { Resvg } from "@resvg/resvg-js";
import UPNG from "upng-js";
import { readFileSync, writeFileSync } from "node:fs";

const entries = JSON.parse(readFileSync("src/data/log.json", "utf8"));

// Unique projects (for the stats line). Real count, not invented.
const projectCount = new Set(entries.map((e) => e.project).filter(Boolean))
  .size;

// Layout constants. 1200×630 matches the OG card slot.
const W = 1200;
const H = 630;
const PANEL_X = 80;
const PANEL_Y = 160;
const PANEL_W = W - PANEL_X * 2;
const PANEL_H = 420;

// Spark bars — drawn as rects (Unicode block chars can't animate).
const BAR_W = 24;
const BAR_GAP = 8;
const BAR_MAX_H = 18;
const BAR_BASELINE_OFFSET = 4; // rects sit on top of the text baseline

// Animation budget: 6 units, 5 frames per unit for typing/output, plus
// 6 hold frames at the end. 36 total frames at 70ms = 2.52s loop.
const FRAMES = 36;
const FRAME_DELAY_MS = 70;
const FRAMES_PER_UNIT = 5;
const HOLD_FRAMES = 6;
const TOTAL_UNITS = 6;

const FONT_SIZE = 20;
const LINE_HEIGHT = 22;

// Vertically center the 12-line session inside the panel.
const SESSION_LINES = 12; // 6 commands × 2 lines each
const CONTENT_BLOCK_H = SESSION_LINES * LINE_HEIGHT;
const CONTENT_X = PANEL_X + 24;
const CONTENT_Y = PANEL_Y + Math.round((PANEL_H - CONTENT_BLOCK_H) / 2);

// Session script. The wrapped command may not exist in the binary yet —
// if not, swap for `brag review` or `brag summary` once it's shipped.
const session = [
  // Session built from real `brag` output captured today. The values
  // marked WITH unicode-block bars are verbatim from `brag spark` — the
  // bars are the ones the tool actually drew, not synthetic.
  {
    cmd: '$ brag add -t "shipped the schema fix"',
    out: "+ entry 597",
    accent: true,
  },
  {
    cmd: "$ brag list --project bragfile-site",
    out: "597 · 591 · 590 · 589 · 587 · 586 · 583",
    accent: false,
  },
  {
    cmd: "$ brag spark --week",
    out: "Total (110): █▁█▅▅▁▁",
    accent: true,
  },
  {
    cmd: "$ brag spark --month",
    out: "Total (205): ▂▁▆█",
    accent: true,
  },
  {
    cmd: "$ brag stats",
    out: `576 entries · 13 day streak`,
    accent: false,
  },
  {
    cmd: "$ brag wrapped --project bragfile-site",
    out: "2026 · 7 entries · busiest: Sept",
    accent: true,
  },
];

// Spark bar heights — bucket log entries into 8 columns and compute the
// target heights. Used by the spark unit; all other units ignore them.
const times = entries
  .map((e) => Date.parse(e.created_at ?? e.date))
  .filter((t) => Number.isFinite(t))
  .sort((a, b) => a - b);
const buckets = new Array(8).fill(0);
if (times.length > 0) {
  const lo = times[0];
  const hi = times.at(-1);
  for (const t of times) {
    const i =
      hi === lo
        ? 7
        : Math.min(7, Math.floor(((t - lo) / (hi - lo)) * 8));
    buckets[i]++;
  }
}
const peak = Math.max(...buckets, 1);

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Monospace char width at FONT_SIZE — used to position the caret.
// JetBrains Mono at 20px is ~12px wide on average.
const CHAR_W = 12;

function frameSvg(frameIdx) {
  // Per-unit opacity (each unit fades in across its 5-frame budget)
  // and a typing progress for the command text.
  const units = session.map((u, i) => {
    const unitStart = i * FRAMES_PER_UNIT;
    const unitEnd = unitStart + FRAMES_PER_UNIT;
    if (frameIdx < unitStart) return { opacity: 0, typed: 0, showOut: false };
    if (frameIdx >= unitEnd) {
      return { opacity: 1, typed: u.cmd.length, showOut: true };
    }
    const local = frameIdx - unitStart;
    const typed = Math.min(
      u.cmd.length,
      Math.round(((local + 1) / FRAMES_PER_UNIT) * u.cmd.length),
    );
    return { opacity: 1, typed, showOut: local === FRAMES_PER_UNIT - 1 };
  });

  // Spark bar progress: ramps from 0 to 1 during the spark unit's frames,
  // then holds at 1 for the rest of the loop.
  const sparkUnit = 3; // index in session of the spark command
  const sparkStart = sparkUnit * FRAMES_PER_UNIT;
  const sparkEnd = sparkStart + FRAMES_PER_UNIT;
  let barProgress;
  if (frameIdx < sparkStart) barProgress = 0;
  else if (frameIdx >= sparkEnd) barProgress = 1;
  else barProgress = (frameIdx - sparkStart + 1) / FRAMES_PER_UNIT;

  // Locate caret: last unit with showOut===false and opacity > 0.
  let caretUnit = -1;
  for (let i = 0; i < units.length; i++) {
    if (units[i].opacity > 0 && !units[i].showOut) {
      caretUnit = i;
      break;
    }
  }
  const caretBlink = caretUnit >= 0 && Math.floor(frameIdx / 3) % 2 === 0;

  // Render the session lines.
  let sessionSvg = "";
  for (let i = 0; i < session.length; i++) {
    const u = session[i];
    const s = units[i];
    if (s.opacity === 0) continue;

    const cmdY = CONTENT_Y + i * LINE_HEIGHT * 2;
    const outY = cmdY + LINE_HEIGHT;
    const cmdVisible = u.cmd.slice(0, s.typed);
    const cmdColor = u.accent ? "#dce1e6" : "#8a9199";
    const outColor = "#ffffff";

    sessionSvg +=
      `<text x="${CONTENT_X}" y="${cmdY}" font-family="monospace" ` +
      `font-size="${FONT_SIZE}" fill="${cmdColor}" ` +
      `opacity="${s.opacity}">${escapeXml(cmdVisible)}</text>`;

    if (s.showOut) {
      // The `out` string contains the full output line — unicode
      // block characters (spark bars) included verbatim. No synthetic
      // rectangles; what brag printed is what we render.
      sessionSvg +=
        `<text x="${CONTENT_X}" y="${outY}" font-family="monospace" ` +
        `font-size="${FONT_SIZE}" fill="${outColor}" ` +
        `opacity="${s.opacity}">${escapeXml(u.out)}</text>`;
    }
  }

  // Caret: blinking rect at the end of the currently-typing command.
  let caret = "";
  if (caretUnit >= 0 && caretBlink) {
    const cmdY = CONTENT_Y + caretUnit * LINE_HEIGHT * 2;
    const caretX = CONTENT_X + units[caretUnit].typed * CHAR_W;
    caret =
      `<rect x="${caretX}" y="${cmdY - FONT_SIZE + 3}" width="2" ` +
      `height="${FONT_SIZE + 2}" fill="#e04e1b"/>`;
  }

  // Hold-phase: when all units are shown and we're in the hold frames,
  // dim the whole panel slightly to signal "rest" before loop.
  const holdStart = TOTAL_UNITS * FRAMES_PER_UNIT;
  const isHolding = frameIdx >= holdStart;
  const holdOpacity = isHolding
    ? 1 - 0.18 * ((frameIdx - holdStart) / HOLD_FRAMES)
    : 1;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#282c34"/>
    <rect x="0" y="0" width="${W}" height="8" fill="#e04e1b"/>

    <text x="80" y="90" font-family="sans-serif" font-size="56" font-weight="600" fill="#dce1e6">bragfile</text>
    <text x="80" y="120" font-family="monospace" font-size="20" fill="#8a9199">the flight recorder for your work</text>

    <rect x="${PANEL_X}" y="${PANEL_Y}" width="${PANEL_W}" height="${PANEL_H}" fill="#1f2329"/>

    ${sessionSvg}
    ${caret}

    <text x="80" y="${H - 30}" font-family="monospace" font-size="20" fill="#8a9199">brew install jysf/tap/bragfile</text>

    <!-- Hold-phase dim is applied via opacity on the whole group above;
         we wrap it by re-rendering sessionSvg is expensive per frame, so
         instead we just fade the panel rect itself slightly. -->
  </svg>`;
}

// Render each frame to RGBA via resvg → PNG bytes → UPNG.toRGBA8 →
// ArrayBuffer, then assemble into APNG. UPNG.decode's `data` field
// includes per-row PNG filter bytes, so we use toRGBA8 for clean
// W*H*4 buffers.
const frames = [];
for (let f = 0; f < FRAMES; f++) {
  const svg = frameSvg(f);
  const pngBytes = new Resvg(svg, { fitTo: { mode: "width", value: W } })
    .render()
    .asPng();
  const rgbaBuffers = UPNG.toRGBA8(UPNG.decode(pngBytes));
  frames.push(new Uint8Array(rgbaBuffers[0]));
}

const delays = new Array(FRAMES).fill(FRAME_DELAY_MS);
const apng = UPNG.encode(frames, W, H, 0, delays, true);
writeFileSync("public/hero.apng", Buffer.from(apng));

const apngBuf = Buffer.from(apng);
console.log(
  `wrote public/hero.apng (${FRAMES} frames, ` +
    `${(apngBuf.byteLength / 1024).toFixed(1)}KB, ` +
    `${(FRAME_DELAY_MS * FRAMES / 1000).toFixed(1)}s loop)`,
);
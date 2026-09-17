// Generates public/hero.apng — animated showcase image used in the page
// hero and as the terminaltrove.com submission image. Run: just hero
//
// The animation is a terminal session captured directly from the user's
// own workflow: brag add (with every flag, including provenance tags),
// then brag list / spark --week / spark --month / stats / wrapped.
// The first command gets the rich treatment — wrapped command lines and
// a multi-line output showing what actually got captured. The rest stay
// tight: one prompt + one output line each, real data verbatim.

import { Resvg } from "@resvg/resvg-js";
import UPNG from "upng-js";
import { readFileSync, writeFileSync } from "node:fs";

const entries = JSON.parse(readFileSync("src/data/log.json", "utf8"));

const projectCount = new Set(
  entries.map((e) => e.project).filter(Boolean),
).size;

// Layout constants.
const W = 1200;
const H = 630;
const PANEL_X = 80;
const PANEL_Y = 160;
const PANEL_W = W - PANEL_X * 2;
const PANEL_H = 440;

// Animation budget.
const FRAMES = 36;
const FRAME_DELAY_MS = 70;
const FRAMES_PER_UNIT = 5;
const HOLD_FRAMES = 6;

const FONT_SIZE = 18;
const LINE_HEIGHT = 21;
const CONTENT_X = PANEL_X + 24;

// Session: each unit has cmd (array of prompt lines) and out (array of
// output lines). All characters are real output captured with the actual
// brag CLI today.
const session = [
  {
    cmd: [
      '$ brag add -t "Hero APNG: provenance on display" \\',
      '         -d "Re-captured a brag with full CLI provenance" \\',
      '         -T design,polish,hero,provenance, \\',
      '            agent:claude-code,model:claude-opus-5 \\',
      '         -p bragfile-site -k shipped \\',
      '         -i "APNG shows real surface, not a stylized one-liner"',
    ],
    out: [
      "+ entry 601",
      "  tags: design,polish,hero,provenance",
      "         agent:claude-code,model:claude-opus-5",
    ],
    accent: true,
  },
  {
    cmd: ["$ brag list --project bragfile-site"],
    out: ["601 · shipped the APNG polish      Sep 16"],
    accent: false,
  },
  {
    cmd: ["$ brag spark --week"],
    out: ["Total (110): █▁█▅▅▁▁"],
    accent: true,
  },
  {
    cmd: ["$ brag spark --month"],
    out: ["Total (205): ▂▁▆█"],
    accent: true,
  },
  {
    cmd: ["$ brag stats"],
    out: ["576 entries · 13 day streak · agent top tag"],
    accent: false,
  },
  {
    cmd: ["$ brag wrapped --project bragfile-site"],
    out: ["2026 · 7 entries · busiest: Sept"],
    accent: true,
  },
];

const TOTAL_LINES = session.reduce(
  (n, u) => n + u.cmd.length + u.out.length,
  0,
);
const CONTENT_BLOCK_H = TOTAL_LINES * LINE_HEIGHT;
const CONTENT_Y = PANEL_Y + Math.round((PANEL_H - CONTENT_BLOCK_H) / 2);

const CHAR_W = 12;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function frameSvg(frameIdx) {
  // Per-unit animation state.
  const units = session.map((u, i) => {
    const unitStart = i * FRAMES_PER_UNIT;
    const unitEnd = unitStart + FRAMES_PER_UNIT;
    if (frameIdx < unitStart) return { opacity: 0, cmdProgress: 0, showOut: false };
    if (frameIdx >= unitEnd) {
      return { opacity: 1, cmdProgress: 1, showOut: true };
    }
    const local = frameIdx - unitStart;
    return {
      opacity: 1,
      cmdProgress: (local + 1) / FRAMES_PER_UNIT,
      showOut: local === FRAMES_PER_UNIT - 1,
    };
  });

  // Locate caret: last unit currently being typed.
  let caretUnit = -1;
  let caretLineIdx = -1;
  for (let i = 0; i < units.length; i++) {
    if (units[i].opacity > 0 && !units[i].showOut) {
      caretUnit = i;
      const u = session[i];
      const cp = units[i].cmdProgress;
      // The caret sits at the end of the last cmd line — which is the
      // line that's still being typed at this progress.
      // Find the deepest line whose typed count > 0; fall back to last line.
      let deepest = u.cmd.length - 1;
      for (let li = 0; li < u.cmd.length; li++) {
        if (Math.round(u.cmd[li].length * cp) > 0) deepest = li;
      }
      caretLineIdx = deepest;
      break;
    }
  }
  const caretBlink = caretUnit >= 0 && Math.floor(frameIdx / 3) % 2 === 0;

  // Render sequentially.
  let sessionSvg = "";
  let yCursor = CONTENT_Y;
  for (let i = 0; i < session.length; i++) {
    const u = session[i];
    const s = units[i];

    // Cmd lines — all type in unison (same cmdProgress across lines).
    for (let li = 0; li < u.cmd.length; li++) {
      if (s.opacity > 0) {
        const totalChars = u.cmd[li].length;
        const visibleChars = Math.round(totalChars * s.cmdProgress);
        const text = u.cmd[li].slice(0, visibleChars);
        const cmdColor = u.accent ? "#dce1e6" : "#8a9199";
        sessionSvg +=
          `<text x="${CONTENT_X}" y="${yCursor}" font-family="monospace" ` +
          `font-size="${FONT_SIZE}" fill="${cmdColor}" ` +
          `opacity="${s.opacity}">${escapeXml(text)}</text>`;
      }
      yCursor += LINE_HEIGHT;
    }

    // Output lines — appear only after showOut.
    for (let li = 0; li < u.out.length; li++) {
      if (s.showOut) {
        const text = u.out[li];
        sessionSvg +=
          `<text x="${CONTENT_X}" y="${yCursor}" font-family="monospace" ` +
          `font-size="${FONT_SIZE}" fill="#ffffff" ` +
          `opacity="${s.opacity}">${escapeXml(text)}</text>`;
      }
      yCursor += LINE_HEIGHT;
    }
  }

  // Caret on the last visible cmd character of the caret unit.
  let caret = "";
  if (caretUnit >= 0 && caretBlink && caretLineIdx >= 0) {
    const u = session[caretUnit];
    const cp = units[caretUnit].cmdProgress;
    let yCursorReset = CONTENT_Y;
    for (let k = 0; k < caretUnit; k++) {
      yCursorReset +=
        (session[k].cmd.length + session[k].out.length) * LINE_HEIGHT;
    }
    yCursorReset += caretLineIdx * LINE_HEIGHT;
    const cmdLine = u.cmd[caretLineIdx];
    const visibleChars = Math.round(cmdLine.length * cp);
    const caretX = CONTENT_X + visibleChars * CHAR_W;
    const caretY = yCursorReset;
    caret =
      `<rect x="${caretX}" y="${caretY - FONT_SIZE + 3}" width="2" ` +
      `height="${FONT_SIZE + 2}" fill="#e04e1b"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#282c34"/>
    <rect x="0" y="0" width="${W}" height="8" fill="#e04e1b"/>

    <text x="80" y="90" font-family="sans-serif" font-size="56" font-weight="600" fill="#dce1e6">bragfile</text>
    <text x="80" y="120" font-family="monospace" font-size="20" fill="#8a9199">the flight recorder for your work</text>

    <rect x="${PANEL_X}" y="${PANEL_Y}" width="${PANEL_W}" height="${PANEL_H}" fill="#1f2329"/>

    ${sessionSvg}
    ${caret}
  </svg>`;
}

// Render frames.
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
    `${(FRAME_DELAY_MS * FRAMES / 1000).toFixed(1)}s loop, ` +
    `${TOTAL_LINES} content lines)`,
);
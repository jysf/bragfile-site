// Generates the hero imagery. Run: just hero
//
//   public/hero.apng          1200x630, the full session — desktop, OG,
//                             and the terminaltrove.com submission image
//   public/hero-poster.png    last frame of the above, for reduced motion
//   public/hero-narrow.apng   640x560, fewer units at larger type — the
//                             phone variant
//   public/hero-narrow-poster.png
//
// Why four files. The wide APNG renders at 327px on a 375px phone: a
// 3.7x downscale of an 18px terminal capture, which lands the type near
// 4px and makes the recording a dark rectangle. The narrow variant drops
// the long `brag add` invocation and raises the type so the same real
// output is legible at phone width. And an APNG animates regardless of
// prefers-reduced-motion — CSS cannot pause it — so each variant also
// emits its final frame as a still for <picture> to select.
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
import { MONO, MONO_ADVANCE, RESVG_FONT } from "./fonts.mjs";

const entries = JSON.parse(readFileSync("src/data/log.json", "utf8"));

const projectCount = new Set(
  entries.map((e) => e.project).filter(Boolean),
).size;

// Animation budget. Shared by both variants so the two recordings keep
// the same cadence.
const FRAME_DELAY_MS = 70;
const FRAMES_PER_UNIT = 5;
const HOLD_FRAMES = 6;

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

// The phone cut. Same units, verbatim — the long `brag add` is dropped
// rather than reflowed, because a wrapped command line at this width
// would stop looking like something a shell printed.
const narrowSession = session.filter((u) => u.cmd[0] !== session[0].cmd[0]);

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// A variant is a size plus a type scale. Everything else is derived, so
// the two recordings stay structurally identical.
function makeVariant({
  name,
  W,
  H,
  panelX,
  panelTop,
  panelBottom,
  fontSize,
  lineHeight,
  titleSize,
  taglineSize,
  session: units,
}) {
  const PANEL_W = W - panelX * 2;
  const PANEL_H = H - panelTop - panelBottom;
  const CONTENT_X = panelX + Math.round(fontSize * 1.33);
  const TOTAL_LINES = units.reduce((n, u) => n + u.cmd.length + u.out.length, 0);
  const CONTENT_BLOCK_H = TOTAL_LINES * lineHeight;
  const CONTENT_Y = panelTop + Math.round((PANEL_H - CONTENT_BLOCK_H) / 2);
  // Every face in MONO_CANDIDATES has a 0.6em advance. The old 2/3
  // estimate walked the caret off the end of a long command line.
  const CHAR_W = fontSize * MONO_ADVANCE;
  const FRAMES = units.length * FRAMES_PER_UNIT + HOLD_FRAMES;

  // The whole point of this variant system is legibility at a given
  // width, so a line that runs off the panel is a build failure, not
  // something to notice later in a screenshot.
  const AVAIL = W - CONTENT_X - panelX;
  const longest = units
    .flatMap((u) => [...u.cmd, ...u.out])
    .reduce((a, b) => (b.length > a.length ? b : a), "");
  if (longest.length * CHAR_W > AVAIL) {
    throw new Error(
      `${name}: longest line is ${longest.length} chars ` +
        `(${Math.ceil(longest.length * CHAR_W)}px) but only ${AVAIL}px fits.\n` +
        `  ${longest}\n` +
        `Drop a unit, or lower fontSize to ` +
        `${Math.floor(AVAIL / (longest.length * MONO_ADVANCE))}.`,
    );
  }

  function frameSvg(frameIdx) {
    // Per-unit animation state.
    const states = units.map((u, i) => {
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
    for (let i = 0; i < states.length; i++) {
      if (states[i].opacity > 0 && !states[i].showOut) {
        caretUnit = i;
        const u = units[i];
        const cp = states[i].cmdProgress;
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
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const s = states[i];

      // Cmd lines — all type in unison (same cmdProgress across lines).
      for (let li = 0; li < u.cmd.length; li++) {
        if (s.opacity > 0) {
          const totalChars = u.cmd[li].length;
          const visibleChars = Math.round(totalChars * s.cmdProgress);
          const text = u.cmd[li].slice(0, visibleChars);
          const cmdColor = u.accent ? "#dce1e6" : "#9aa3ad";
          sessionSvg +=
            `<text xml:space="preserve" x="${CONTENT_X}" y="${yCursor}" font-family="${MONO.family}" ` +
            `font-size="${fontSize}" fill="${cmdColor}" ` +
            `opacity="${s.opacity}">${escapeXml(text)}</text>`;
        }
        yCursor += lineHeight;
      }

      // Output lines — appear only after showOut.
      for (let li = 0; li < u.out.length; li++) {
        if (s.showOut) {
          const text = u.out[li];
          sessionSvg +=
            `<text xml:space="preserve" x="${CONTENT_X}" y="${yCursor}" font-family="${MONO.family}" ` +
            `font-size="${fontSize}" fill="#ffffff" ` +
            `opacity="${s.opacity}">${escapeXml(text)}</text>`;
        }
        yCursor += lineHeight;
      }
    }

    // Caret on the last visible cmd character of the caret unit.
    let caret = "";
    if (caretUnit >= 0 && caretBlink && caretLineIdx >= 0) {
      const u = units[caretUnit];
      const cp = states[caretUnit].cmdProgress;
      let yCursorReset = CONTENT_Y;
      for (let k = 0; k < caretUnit; k++) {
        yCursorReset += (units[k].cmd.length + units[k].out.length) * lineHeight;
      }
      yCursorReset += caretLineIdx * lineHeight;
      const cmdLine = u.cmd[caretLineIdx];
      const visibleChars = Math.round(cmdLine.length * cp);
      const caretX = CONTENT_X + visibleChars * CHAR_W;
      const caretY = yCursorReset;
      caret =
        `<rect x="${caretX}" y="${caretY - fontSize + 3}" width="2" ` +
        `height="${fontSize + 2}" fill="#e04e1b"/>`;
    }

    const titleY = Math.round(panelTop * 0.56);
    const taglineY = titleY + Math.round(taglineSize * 1.5);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="#282c34"/>
      <rect x="0" y="0" width="${W}" height="8" fill="#e04e1b"/>

      <text x="${panelX}" y="${titleY}" font-family="sans-serif" font-size="${titleSize}" font-weight="600" fill="#dce1e6">bragfile</text>
      <text x="${panelX}" y="${taglineY}" font-family="${MONO.family}" font-size="${taglineSize}" fill="#9aa3ad">the flight recorder for your work</text>

      <rect x="${panelX}" y="${panelTop}" width="${PANEL_W}" height="${PANEL_H}" fill="#1f2329"/>

      ${sessionSvg}
      ${caret}
    </svg>`;
  }

  // Render frames.
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const pngBytes = new Resvg(frameSvg(f), {
      fitTo: { mode: "width", value: W },
      font: RESVG_FONT,
    })
      .render()
      .asPng();
    const rgbaBuffers = UPNG.toRGBA8(UPNG.decode(pngBytes));
    frames.push(new Uint8Array(rgbaBuffers[0]));
  }

  return { name, W, H, FRAMES, TOTAL_LINES, frames, lastSvg: frameSvg(FRAMES - 1) };
}

function write(variant, apngPath, posterPath) {
  const { W, H, FRAMES, TOTAL_LINES, frames, lastSvg } = variant;

  const delays = new Array(FRAMES).fill(FRAME_DELAY_MS);
  const apng = Buffer.from(UPNG.encode(frames, W, H, 0, delays, true));
  writeFileSync(apngPath, apng);

  // The still is the settled end state — every command run, every output
  // on screen — so a reduced-motion visitor sees the whole session at
  // once rather than the first frame of an empty terminal.
  const poster = Buffer.from(
    new Resvg(lastSvg, {
      fitTo: { mode: "width", value: W },
      font: RESVG_FONT,
    })
      .render()
      .asPng(),
  );
  writeFileSync(posterPath, poster);

  console.log(
    `wrote ${apngPath} (${W}x${H}, ${FRAMES} frames, ` +
      `${(apng.byteLength / 1024).toFixed(1)}KB, ` +
      `${((FRAME_DELAY_MS * FRAMES) / 1000).toFixed(1)}s loop, ` +
      `${TOTAL_LINES} content lines)`,
  );
  console.log(
    `wrote ${posterPath} (${(poster.byteLength / 1024).toFixed(1)}KB still)`,
  );
}

write(
  makeVariant({
    name: "wide",
    W: 1200,
    H: 630,
    panelX: 80,
    panelTop: 160,
    panelBottom: 30,
    fontSize: 18,
    lineHeight: 21,
    titleSize: 56,
    taglineSize: 20,
    session,
  }),
  "public/hero.apng",
  "public/hero-poster.png",
);

write(
  makeVariant({
    name: "narrow",
    W: 640,
    H: 560,
    panelX: 32,
    panelTop: 156,
    panelBottom: 32,
    fontSize: 20,
    lineHeight: 27,
    titleSize: 54,
    taglineSize: 20,
    session: narrowSession,
  }),
  "public/hero-narrow.apng",
  "public/hero-narrow-poster.png",
);

console.log(`(${entries.length} entries across ${projectCount} projects)`);

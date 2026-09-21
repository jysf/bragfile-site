// Font resolution for the resvg-based image generators (hero.mjs, og.mjs).
//
// resvg resolves the generic `monospace` and `sans-serif` families to
// whatever its font database happens to offer first, which on this machine
// is a PROPORTIONAL face for both. That is invisible in prose and fatal in
// terminal output: the committed hero had columns that did not line up and
// `brag spark` bars at unequal widths — the same defect the page itself had
// from Astro's Arial fallback. Name real font files, and throw rather than
// silently render proportional "terminal" output.

import { existsSync } from "node:fs";

const MONO_CANDIDATES = [
  { file: "/System/Library/Fonts/Menlo.ttc", family: "Menlo" },
  {
    file: "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    family: "DejaVu Sans Mono",
  },
  { file: "/usr/share/fonts/TTF/DejaVuSansMono.ttf", family: "DejaVu Sans Mono" },
  {
    file: "/usr/share/fonts/liberation/LiberationMono-Regular.ttf",
    family: "Liberation Mono",
  },
];

const SANS_CANDIDATES = [
  { file: "/System/Library/Fonts/Helvetica.ttc", family: "Helvetica" },
  { file: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", family: "DejaVu Sans" },
  { file: "/usr/share/fonts/TTF/DejaVuSans.ttf", family: "DejaVu Sans" },
  {
    file: "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
    family: "Liberation Sans",
  },
];

function pick(candidates, kind) {
  const found = candidates.find((c) => existsSync(c.file));
  if (found) return found;
  throw new Error(
    `No ${kind} font file found. Tried:\n  ` +
      candidates.map((c) => c.file).join("\n  ") +
      `\nAdd one to scripts/fonts.mjs.` +
      (kind === "monospace"
        ? " The block characters in `brag spark` output only align in a real monospace face."
        : ""),
  );
}

export const MONO = pick(MONO_CANDIDATES, "monospace");
export const SANS = pick(SANS_CANDIDATES, "sans-serif");

// Every face in MONO_CANDIDATES has a 0.6em advance.
export const MONO_ADVANCE = 0.6;

// loadSystemFonts stays on for anything not pinned here; fontFiles plus the
// explicit family names guarantee the two that matter.
export const RESVG_FONT = {
  loadSystemFonts: true,
  fontFiles: [MONO.file, SANS.file],
  defaultFontFamily: SANS.family,
  sansSerifFamily: SANS.family,
  monospaceFamily: MONO.family,
};

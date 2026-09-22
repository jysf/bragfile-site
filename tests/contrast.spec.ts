// Contrast and palette-drift guards.
//
// These exist because five text styles shipped under WCAG AA and stylelint
// passed the whole time. The existing `declaration-strict-value` rule enforces
// "use a token" — it cannot enforce "this token on that background is legible",
// because it never sees the pairing. Three failure modes got through it:
//
//   1. A token that is simply too quiet. --muted was #8a9199, 4.39:1 on
//      --base, which is under AA at the 13px meta size it carries.
//   2. `opacity` used for hierarchy. It composites against whatever band is
//      behind it, so ONE rule gave 4.88:1 in the hero and 2.24:1 on the CTA —
//      on the install command, the most important string on the page.
//   3. Palette drift in worker/stats.ts. That file inlines the palette because
//      it is Worker-rendered, outside Astro's pipeline, and stylelint's glob
//      (src/**) never reaches it. Its own comment asks for hand-syncing, which
//      is exactly the instruction that does not survive a palette change.
//
// Pure string parsing: no browser, no build. Runs on `node --test` with type
// stripping, like the other spec here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- contrast

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const h = expand(hex);
  const channels = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG 2.x contrast ratio, 1–21. */
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function expand(hex: string): string {
  const h = hex.replace('#', '').toLowerCase();
  return h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ------------------------------------------------------------------ tokens

const TOKENS_CSS = readFileSync('src/styles/tokens.css', 'utf8');

function token(name: string): string {
  const m = TOKENS_CSS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  assert.ok(m, `--${name} not found in tokens.css`);
  return expand(m![1]);
}

const base = token('base');
const panel = token('panel');
const signal = token('signal');
const text = token('text');
const muted = token('muted');
const output = token('output');
const ink = token('ink');

// Every foreground/background pair the page actually renders, with the ratio
// WCAG requires at the size it is used. 4.5 for normal text, 3.0 for large
// (>=24px, or >=18.66px bold) and for non-text UI boundaries.
const PAIRS: Array<[string, string, string, number, string]> = [
  ['--text on --base', text, base, 4.5, 'all body copy'],
  ['--text on --panel', text, panel, 4.5, 'body copy on panel bands'],
  ['--muted on --base', muted, base, 4.5, 'meta, timestamps, table headers at 13px'],
  ['--muted on --panel', muted, panel, 4.5, 'the same, inside frames'],
  ['--ink on --signal', ink, signal, 4.5, 'CTA body, install command, button label'],
  ['--output on --panel', output, panel, 4.5, 'terminal output inside frames'],
  ['--signal on --base', signal, base, 3.0, 'display numbers only, >=24px'],
  ['--signal on --panel', signal, panel, 3.0, 'the accent stat, >=24px'],
];

for (const [name, fg, bg, need, where] of PAIRS) {
  test(`contrast: ${name} >= ${need}:1 (${where})`, () => {
    const got = round(contrast(fg, bg));
    assert.ok(
      got >= need,
      `#${fg} on #${bg} is ${got}:1, needs ${need}:1 — ${where}`,
    );
  });
}

test('contrast: --signal is NOT used for normal-size text anywhere', () => {
  // 3.52:1. DESIGN-SPEC.md reserves it for display type, rules and the CTA
  // panel. This asserts the reason, so nobody "fixes" the spec by promoting it.
  assert.ok(
    contrast(signal, base) < 4.5,
    '--signal now clears 4.5:1 on --base. If that is deliberate, update ' +
      'DESIGN-SPEC.md and delete this test — but check the white sparkline ' +
      'blocks beside it first.',
  );
});

// ------------------------------------------------- opacity as hierarchy

const ASTRO_FILES = [
  ...readdirSync('src/components').map((f) => join('src/components', f)),
  ...readdirSync('src/layouts').map((f) => join('src/layouts', f)),
  ...readdirSync('src/pages').map((f) => join('src/pages', f)),
].filter((f) => f.endsWith('.astro'));

test('no opacity outside @keyframes in component styles', () => {
  const offenders: string[] = [];

  for (const file of ASTRO_FILES) {
    const css = readFileSync(file, 'utf8');
    // Blank out @keyframes bodies: animating opacity is fine, it is the
    // static `opacity: .6` on a text rule that silently halves contrast.
    const withoutKeyframes = css.replace(
      /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,
      '',
    );
    for (const m of withoutKeyframes.matchAll(/opacity:\s*(0?\.\d+|0)\s*;/g)) {
      offenders.push(`${file}: opacity: ${m[1]}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'Use a color token instead. opacity composites against whatever band is ' +
      'behind the element, so one rule yields different contrast per section:\n  ' +
      offenders.join('\n  '),
  );
});

// ------------------------------------------------- worker palette drift

test('worker/stats.ts uses only colors from tokens.css', () => {
  // stylelint's glob is src/**, so this file is unlinted. Its own header says
  // "keep them in sync with tokens.css if the palette changes" — this is that
  // instruction, enforced.
  const allowed = new Set([base, panel, signal, text, muted, output, ink]);
  const css = readFileSync('worker/stats.ts', 'utf8');

  const used = new Set<string>();
  for (const m of css.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)) {
    used.add(expand(m[1]));
  }

  const strays = [...used].filter((c) => !allowed.has(c));
  assert.deepEqual(
    strays,
    [],
    `worker/stats.ts uses colors that are not tokens: ${strays
      .map((c) => '#' + c)
      .join(', ')}. Add them to tokens.css or use an existing token.`,
  );
});

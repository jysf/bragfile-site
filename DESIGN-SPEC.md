# bragfile landing page — design spec

Paste this into every AdaL session. It is the source of truth for color, type,
spacing, components, and voice. If something isn't in here, ask before inventing it.

---

## The subject

`bragfile` is a local-first CLI that captures what you got done — shipped, fixed,
learned, mentored — into SQLite at `~/.bragfile/db.sqlite`. No cloud, no account,
no sync. You retrieve it later for retros, reviews, and resumes. An MCP server
lets coding agents capture their own work as they go.

**Audience:** developers who work with agents and have lost track of what got done.

**Lead angle:** review-season recall. **Differentiator:** agent provenance.

**The recursive concept:** every step of building this page was captured by the
tool the page is about. The log is real, captured live, and rendered on the page.

---

## Visual direction: flight recorder

Not the crash — the investigation. A recorder runs on every flight, and almost
every flight lands fine. You don't record because you expect failure; you record
because you can't know in advance which day mattered. Retrieval has a purpose
built into the metaphor, which is exactly what a `learn` entry is for.

Register: plain, investigative, unhurried. Findings, not marketing.

---

## Color

Seven values. Sampled from the product's own terminal output so screenshots look
native to the page rather than pasted onto it.

```css
--base:   #282C34;  /* page background — sampled from the terminal theme */
--panel:  #1F2329;  /* recessed frames, terminal containers */
--signal: #E04E1B;  /* the orange — Golden Gate, brightened to survive dark */
--text:   #DCE1E6;  /* body copy */
--muted:  #9AA3AD;  /* secondary text, metadata, timestamps */
--white:  #FFFFFF;  /* RESERVED: terminal output only. Never for page text. */
--ink:    #121418;  /* RESERVED: type ON --signal. Never anywhere else. */
```

**Rules**

- `--white` appears *only* inside terminal frames. It is the sparkline blocks and
  nothing else. That reservation is what makes the real output read as evidence.
- `--signal` never carries body text — it fails contrast on dark at small sizes.
  Use it for display type, rules, the CTA panel, and active states only.
- Exactly one orange. No tints, no gradients, no second accent color.
- The final CTA is a full-bleed `--signal` panel with `--ink` type on it. That
  is the one loud moment on the page. Nothing else competes with it.
- **Never use `opacity` to make text quieter.** It composites against whatever
  band is behind it, so one rule produced 4.88:1 in the hero and 2.24:1 on the
  CTA — on the install command, the most important string on the page. Reach for
  a color token instead.

**Why `--ink`, and why `--muted` moved**

`--base` on `--signal` is 3.52:1. That carries the 32px head on the CTA panel
(large text needs 3:1) but not the body copy, the install command or the button
label that share it. The orange itself is not negotiable — it was picked against
a real `brag spark` screenshot with white blocks adjacent, and every darker
orange that helps white *hurts* dark type. So the ink darkens instead: `--ink`
on `--signal` is 4.63:1, and `--signal` keeps its exact hex.

`--muted` was `#8A9199`, which is 4.39:1 on `--base` — just under AA at the 13px
meta size it is used at. `#9AA3AD` is 5.48:1 and the same hue.

**If testing variants:** hold everything else fixed, change only the hex, and
judge each against a real `brag spark` screenshot with white blocks adjacent.
An orange that gets flattened by the white next to it is disqualified.

---

## Type

Two families, clearly distinct.

**JetBrains Mono** — all terminal output, data rows, counts, timestamps, commands.
Chosen because it renders the block characters `▁▂▃▄▅▆▇█` correctly. Verify this
before committing to any alternative; many monospace faces lack them.

The face having the glyphs is not sufficient — **the fallback chain has to be
monospace too.** Astro subsets Google fonts to `latin`, which stops at U+024F, so
the blocks (U+2580–259F) never came from JetBrains Mono at all; they fell through
to Astro's default fallback, which is Arial. `▄` and `█` rendered 14.3px against
9.0px for every other character, and each sparkline came out ragged. The mono
family therefore declares its own `fallbacks` in `astro.config.mjs`. The same
trap exists in `scripts/hero.mjs`: resvg resolves generic `monospace` to whatever
its font database offers first, so that script names a real font file and throws
if it cannot find one.

**Check both after any font change:** compare the advance width of `█` against
`M` in the page, and look at a generated `hero.apng` frame.

**Archivo** — headings and body. A signage-derived grotesque, industrial without
being a costume. Use Archivo Expanded for the hero only.

**Scale** (five sizes, no more):

| Role | Size | Face | Notes |
|---|---|---|---|
| Hero | 64px / 1.05 | Archivo Expanded 600 | Sentence case |
| Section head | 32px / 1.2 | Archivo 600 | |
| Body | 17px / 1.6 | Archivo 400 | Max 72ch line length |
| Data row | 15px / 1.4 | JetBrains Mono 400 | |
| Meta | 13px / 1.4 | JetBrains Mono 400 | `--muted` |

---

## Spacing

Base unit **8px**. Every margin, padding, and gap is a multiple of 8. No
exceptions, no one-off values. Section padding: 96px top and bottom on desktop,
48px on mobile.

---

## Layout

Left-aligned, single column, content max-width 720px, with terminal frames
allowed to break wider to 960px.

Most dev tool pages center their hero. Left alignment is deliberate here: a
recorder produces a log, and a log reads top-to-bottom from a consistent left
margin. It also gives the terminal frames a shared edge with the prose, which
centered layouts can't do.

**The columns are left-aligned; the block they sit in is centered.** Bands stay
full-bleed, but their contents sit inside a centered `--column-wide` block via
the `--gutter` token. Below ~1008px that gutter is just the 24px page margin and
nothing changes. Above it, a fixed left margin meant the whole page drifted to
one side of the window — at 1440px the content ended at 984px and left 456px of
dead screen. Centering the *block* rather than each column keeps both rules
above: 720 and 960 still start at the same x, so the prose and the frames keep
their shared edge, and the log still reads from one consistent margin.

---

## Components

Five. Build no others.

**1. Data row** — derived from `brag spark` output: `label (count): ▁▂▃█`
Label left, count in parens, blocks right. Reuse this pattern for feature rows
and findings, not just for spark output. It is the page's signature structure and
it came from the product itself.

**2. Terminal frame** — `--panel` background, 24px padding, no window chrome, no
fake traffic-light dots. Real output only, never recolored. On mobile, horizontal
scroll inside the frame rather than reflowing or shrinking the type.

**3. Placard** — the four-field header block lifted from spark output:
`Generated: / Scope: / Filters: / Entries:`. Use this shape for section metadata.
Mono, `--muted`, left-aligned.

**4. Finding** — a `learn` entry rendered as an investigation finding: date,
one-line statement, plain prose. Numbered *only* here, because findings genuinely
are an enumerated list in a report.

**5. Button** — solid `--signal`, `--base` text, 4px radius, no shadow, no arrow
glyph. Label says what happens: "Copy install command", not "Get started".

---

## Motion

One orchestrated moment on page load, or none. No fade-and-slide on every
section, no hover transition on every element. Motion that responds to a click
(copy confirmation) is welcome. Respect `prefers-reduced-motion`.

---

## Voice

Plain verbs, sentence case, active voice, no filler. Write like an engineer
explaining something to another engineer, not like a landing page.

**Banned:** seamless, effortless, revolutionize, supercharge, unlock, "never lose
track again", "your work, amplified". Any sentence that would be equally true of
a different product.

**Two tests before a line ships:**
1. Delete any sentence containing no information.
2. Read it aloud. If you'd be embarrassed saying it to another engineer, cut it.

**Hard constraints:** no testimonials, no customer logos, no invented statistics,
no claims about users or adoption. None of these exist yet and fabricating them
poisons a page whose entire argument is that the data is real.

**Numbers come from the live bragfile DB at build time.** Anything that isn't a
verbatim terminal-frame rendering — body copy, headlines, the OG card, the
install CTA panel — gets its numbers from the source, not from this spec.
The spec doesn't pin counts because they will drift every day; pinning them
just creates stale copy.

---

## Tells to avoid

These read as generated. Check against this list before shipping a section.

- All-caps tracked-out eyebrow labels above headings.
- Accenting one word of the headline in orange.
- Numbered markers (01 / 02 / 03) on content that isn't a sequence.
- Meta strings joined with middle dots.
- Identical rounded cards with the same soft grey shadow.
- Gradient washes as decoration.
- An arrow glyph appended to button and link text.
- Monospace used decoratively for small labels. Here mono means *this is real
  program output or a real command* — if it's neither, set it in Archivo.

---

## Scope

Six sections, finished, beats twelve half-built.

1. Hero — what it is, one command, one real terminal frame
2. The problem — you forget; the blank review form
3. How it works — `add` / `search` / `export` as three steps
4. What comes out — wrapped, exports, coverage
5. The log — this page, building itself, with findings
6. Local-first + install CTA

**Cut in this order if behind:** features shrink to three, FAQ goes entirely,
findings drop to three entries, generated imagery reduces to hero only.

**Never cut:** deployment, mobile, the log section.

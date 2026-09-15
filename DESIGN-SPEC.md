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

Six values. Sampled from the product's own terminal output so screenshots look
native to the page rather than pasted onto it.

```css
--base:   #282C34;  /* page background — sampled from the terminal theme */
--panel:  #1F2329;  /* recessed frames, terminal containers */
--signal: #E04E1B;  /* the orange — Golden Gate, brightened to survive dark */
--text:   #DCE1E6;  /* body copy */
--muted:  #8A9199;  /* secondary text, metadata, timestamps */
--white:  #FFFFFF;  /* RESERVED: terminal output only. Never for page text. */
```

**Rules**

- `--white` appears *only* inside terminal frames. It is the sparkline blocks and
  nothing else. That reservation is what makes the real output read as evidence.
- `--signal` never carries body text — it fails contrast on dark at small sizes.
  Use it for display type, rules, the CTA panel, and active states only.
- Exactly one orange. No tints, no gradients, no second accent color.
- The final CTA is a full-bleed `--signal` panel with `--base` type on it. That
  is the one loud moment on the page. Nothing else competes with it.

**If testing variants:** hold everything else fixed, change only the hex, and
judge each against a real `brag spark` screenshot with white blocks adjacent.
An orange that gets flattened by the white next to it is disqualified.

---

## Type

Two families, clearly distinct.

**JetBrains Mono** — all terminal output, data rows, counts, timestamps, commands.
Chosen because it renders the block characters `▁▂▃▄▅▆▇█` correctly. Verify this
before committing to any alternative; many monospace faces lack them.

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

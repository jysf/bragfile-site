# Agent instructions — bragfile-site

## Brag capture (required, continuous)

Capture work into bragfile as you go. This log is content: it renders on the
page, so it must be captured live and never reconstructed at the end.

Use `--project bragfile-site` for ALL entries. Do not use the `bragfile`
project; that's for tool development.

Capture when you ship something visible, fix something broken, learn something
worth remembering (**including dead ends**), or make a decision with a tradeoff.

Do not capture individual file edits, formatting, or dependency installs.
Aim for 5-10 entries a day, not 50.

One plain sentence per entry: what happened and why it mattered. No marketing
voice. Tag by page section so entries can be joined to sections at render time:
`--tag hero`, `--tag design`, `--tag log`.

## Brag format

Every entry carries provenance and impact — these are required, not optional:

- **Tags** must include `agent:<name>`, `model:<name>`, `session:<uuid>` so
  the log section can attribute work to a specific run. The `brag` MCP fills
  these in automatically; from the CLI, append them to the tag list.
- **Impact** is a one-sentence statement of the outcome — what changed
  because of this work, not what was done. Pattern: "Unblocked X" /
  "Pinned Y so Z works" / "Page now renders W".

`brag edit` is editor-only; for programmatic updates use
`brag delete --yes` then `echo '{...}' | brag add --json` (DEC-012
schema on stdin). New IDs are assigned on re-add; the page consumes
by content, not ID.

## Stack — already decided, do not propose alternatives

- Astro 7, static output
- Plain CSS in Astro scoped `<style>` blocks. No Tailwind, no CSS framework.
- Design tokens as custom properties in `src/styles/tokens.css`
- Astro's built-in Fonts API (configured in `astro.config.mjs`)
- Cloudflare Pages

## Design system

`src/styles/tokens.css` is the single source of truth. stylelint rejects raw
colors, font families and sizes anywhere else — `npm run lint` fails on them.
If you need a value that isn't a token, add it to `tokens.css` rather than
inlining it.

Full brief, voice rules and tells to avoid: `DESIGN-SPEC.md`.

## Copy

All copy is written with AdaL. Sections in `src/pages/index.astro` are marked
`TODO` with a comment describing the job each does. Read `DESIGN-SPEC.md`
before writing any of it.

Hard constraints: no testimonials, no customer logos, no invented statistics,
no claims about users or adoption. The only numbers permitted are the real ones
listed in the spec.

## Scope

Six sections, finished, beats twelve half-built. Do not add sections.
Never cut: deployment, mobile, or the log section.

## Before finishing any session

Run `npm run build` and `npm run lint`. Both must pass.

# AdaL session prompts — bragfile-site

Run these as **separate sessions**, not one long thread. Fresh context per session
keeps credit burn down and stops the agent re-deriving state it already settled.

Commit after every session that ends in a working state.

---

## Session 0 — kickoff (plan only, no code)

> I'm building a landing page for `bragfile`, a local-first CLI that captures what
> a developer got done — shipped, fixed, learned, mentored — into SQLite at
> `~/.bragfile/db.sqlite`. No cloud, no account, no sync. You retrieve it later for
> retros, reviews and resumes. It has an MCP server so coding agents capture their
> own work as they go. Repo: github.com/jysf/bragfile000
>
> Read DESIGN-SPEC.md in this directory. It is the brief: colour, type, spacing,
> voice, and a list of tells to avoid. Treat it as binding.
>
> Stack, already decided — do not propose alternatives:
> - Astro 7, static output
> - Plain CSS using Astro's scoped `<style>` blocks. No Tailwind, no CSS framework.
> - Design tokens as custom properties in one global stylesheet, imported everywhere.
> - Astro's built-in Fonts API for Archivo and JetBrains Mono.
> - stylelint with stylelint-declaration-strict-value, configured so any raw hex or
>   raw pixel value in a colour or spacing declaration fails the check.
> - Deploy to Cloudflare Pages.
>
> **This session: plan only. Write no code yet.**
>
> Give me:
> 1. The file tree you intend to create.
> 2. The six page sections, each with a one-line statement of the job it does.
> 3. Your hero concept — what the reader sees first and why that, specifically, for
>    this product. The spec's visual direction is a flight recorder: the investigation,
>    not the crash. Recording is a default, not pessimism.
> 4. Three things in the spec you think are wrong or would weaken the page.
>
> Then stop and wait.

**Why point 4:** an agent that agrees with everything isn't reading. If the pushback
is thoughtful, the brief landed. If it's generic, re-feed the spec before building.

---

## Session 1 — scaffold and deploy

> Create the Astro 7 project per the plan we agreed. This session covers:
> - project init, static output config
> - the global stylesheet with the tokens from DESIGN-SPEC.md as custom properties
> - Fonts API setup for Archivo and JetBrains Mono
> - stylelint configured and passing
> - a `Base` layout with head, meta and OG tags
> - one page rendering the six section headings with placeholder text
>
> Then run `npm run build` and confirm it passes. If it fails, fix it before doing
> anything else — I need to know today whether this stack builds.
>
> No design work, no copy, no components beyond the layout.

Then deploy it to Cloudflare Pages yourself, by hand. Ugly is fine. From here every
day improves something that already exists.

---

## Session 2 — copy

> Read DESIGN-SPEC.md for voice and constraints. Write the copy for the page.
>
> Work in this order, stopping after each for me to choose:
> 1. One positioning sentence. Give me three options.
> 2. The headline. Give me ten options, no commentary.
> 3. Then section by section, with the chosen headline in context.
>
> Hard constraints: no testimonials, no customer logos, no invented statistics, no
> claims about users or adoption. The only numbers you may use are the real ones in
> the spec. Do not write a sentence that would be equally true of a different product.

---

## Session 3 — components and the visual system

> Build the five components in DESIGN-SPEC.md using Astro scoped styles:
> data row, terminal frame, placard, finding, button. Nothing else.
>
> Then apply the visual system to the page: hero treatment, section rhythm, the
> full-bleed signal-coloured CTA panel, terminal frame styling.
>
> stylelint must pass — no raw hex, no raw pixel values.
> Left-aligned, single column, content max-width 720px, terminal frames may go to 960px.
> One load animation at most. Respect prefers-reduced-motion.

---

## Session 4 — the log section

> The page renders my real bragfile entries for this build. `src/data/log.json` is a
> `brag export --format json` dump: each entry has date, type, text, project, tags.
>
> Build: a loader that reads it at build time, the findings block rendering `learned`
> entries as numbered investigation findings, and a computed "last entry: N hours ago"
> line.
>
> Numbering appears here and nowhere else on the page.

---

## Session 5 — mobile and polish

> Make the page work down to 360px. The terminal frames are the hard part: monospace
> output can't reflow, so use horizontal scroll inside the frame rather than shrinking
> the type.
>
> Then: favicon, OG image, page title and description, keyboard focus visible,
> check every link.

---

## Session 6 — freeze

Do this one yourself. Regenerate `log.json`, drop in final screenshots, add the last
brag entry, build, deploy, stop.

---

## Running rules for every session

- Tell it which files to touch. Don't let it explore the repo.
- Use scoped turn-by-turn mode. Reserve Engineer mode for sessions 1 and 4.
- Route mechanical edits to a local model via Ollama.
- Check `/skills` once and drop anything irrelevant to a static site build.
- Capture brags as you go — `--project bragfile-site`, tagged by section.
  The log is content. It cannot be reconstructed on the 18th.

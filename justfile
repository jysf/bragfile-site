# bragfile-site — task runner
# Run `just` (no args) to list recipes. Deploy to Cloudflare Pages is not
# wrapped here — handle it manually per README.md.

# Default: list recipes
default:
    @just --list

# Install dependencies (forces devDependencies even if NODE_ENV=production
# is set in the shell — stylelint and the OG renderer live there)
install:
    npm install --include=dev --no-fund --no-audit

# Dev server with hot reload (http://localhost:4321)
dev:
    npm run dev

# Build the site for production — output goes to ./dist
build:
    npm run build

# Preview the production build locally
preview:
    npm run preview

# stylelint — raw colors and font sizes outside tokens.css fail
lint:
    npm run lint

# Regenerate src/data/log.json from bragfile. Run after new entries.
log:
    npm run log

# Regenerate public/og.png from the current log. Run at freeze time.
og:
    npm run og

# Regenerate public/hero.apng — animated showcase image used in the page
# hero and as the terminaltrove.com submission image. Run after any log
# update; the bars are derived from the current entry distribution.
hero:
    node scripts/hero.mjs

# Refresh every artifact that depends on the log: log.json → og.png → hero.apng
artifacts: log og hero

# One-time Cloudflare auth — opens a browser. Run before `just deploy`.
login:
    npx wrangler login

# Deploy the current build to Cloudflare Pages. The Pages project must
# exist (create it in the dashboard first) and the custom domain
# `bragfile.jysf.org` must be attached to the project.
deploy:
    npx wrangler pages deploy dist --project-name bragfile

# lint + build — required by AGENTS.md before finishing a session
check: lint build

# Remove build artifacts and dependencies
clean:
    rm -rf node_modules dist .astro

# Reset — clean, install, and verify
reset: clean install check
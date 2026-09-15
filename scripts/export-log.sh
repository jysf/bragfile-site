#!/usr/bin/env bash
# Regenerate the site's log data from bragfile itself.
# Run whenever you want the page to reflect new entries, and once more
# at freeze time on day 6 after the final entry.
set -euo pipefail

brag export --format json --project bragfile-site > src/data/log.json
echo "wrote src/data/log.json ($(grep -c '"created_at"' src/data/log.json) entries)"

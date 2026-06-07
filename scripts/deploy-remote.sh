#!/usr/bin/env bash
# Safe remote deploy for Chahrity backend.
#
# Runs on the SERVER (the old PC). Encodes the lessons from the 2026-06-07 incident:
#   - refuse to pull on top of stale local edits
#   - verify clean boot after restart (no ERR_* in error log)
#   - verify the public health endpoint actually answers
#
# Usage (on the server):  bash scripts/deploy-remote.sh
# Or from your laptop:    ssh server "cd ~/finance-app && bash scripts/deploy-remote.sh"

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/finance-app}"
PM2_APP="${PM2_APP:-chahrity-api}"
HEALTH_URL="${HEALTH_URL:-https://api.chahrity.com/api/health}"

red()   { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[34m%s\033[0m\n' "$*"; }

fail() { red "ABORT: $*"; exit 1; }

cd "$APP_DIR" || fail "App dir not found: $APP_DIR"

blue "==> Step 1/6: Check working tree"
if [ -n "$(git status --porcelain)" ]; then
    red "Local changes exist on the server:"
    git status --short >&2
    fail "Resolve these manually (stash, commit, or discard) before deploying. We will not overwrite uncommitted server-side edits."
fi
green "    Working tree clean."

blue "==> Step 2/6: Pull latest"
git fetch origin
before=$(git rev-parse HEAD)
git pull --ff-only origin main || fail "Non-fast-forward pull. Investigate manually."
after=$(git rev-parse HEAD)
if [ "$before" = "$after" ]; then
    green "    Already up to date ($after)."
else
    green "    Pulled $before -> $after"
fi

blue "==> Step 3/6: Install dependencies (backend)"
cd "$APP_DIR/backend"
npm install --no-audit --no-fund || fail "npm install failed."
green "    Dependencies installed."

blue "==> Step 4/6: Boot smoke test"
npx vitest run tests/smoke.test.js --reporter=default || fail "Smoke test failed. NOT restarting pm2 — your app would crash-loop in prod."
green "    Smoke test passed."

blue "==> Step 5/6: Restart pm2 process"
pm2 restart "$PM2_APP" --update-env || fail "pm2 restart failed."
sleep 3

# Look for boot errors written AFTER the restart.
# We grep for ERR_ codes (e.g., ERR_REQUIRE_ESM) in the last 30 lines of the error log.
recent_errs=$(pm2 logs "$PM2_APP" --err --lines 30 --nostream 2>/dev/null | grep -E "code: 'ERR_|Error \[" | tail -5 || true)
if [ -n "$recent_errs" ]; then
    red "Boot errors detected in pm2 error log:"
    printf '%s\n' "$recent_errs" >&2
    fail "App may be crash-looping. Inspect with: pm2 logs $PM2_APP"
fi
green "    pm2 restarted clean."

blue "==> Step 6/6: Verify public health endpoint"
http_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo "000")
if [ "$http_code" != "200" ]; then
    fail "Health check failed: $HEALTH_URL returned $http_code (expected 200)."
fi
green "    Health OK ($HEALTH_URL -> 200)."

echo
green "DEPLOY OK — $after is live."

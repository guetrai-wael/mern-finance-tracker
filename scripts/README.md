# scripts/

## `deploy-remote.sh`

Safe deploy script for the self-hosted backend. Run **on the server**:

```bash
cd ~/finance-app
bash scripts/deploy-remote.sh
```

What it does, in order:

1. Refuses to proceed if `git status` is dirty (no overwriting uncommitted server edits).
2. `git pull --ff-only origin main` — explicit, no surprise merges.
3. `npm ci` in `backend/`. Installs the exact versions from the committed
   lockfile rather than re-resolving caret ranges, which is what makes a local
   `npm audit` mean anything in production. Fails fast on lockfile drift.
4. Runs the boot smoke test (`backend/scripts/boot-smoke.js` — deliberately a
   plain node script, not a vitest test, because the deploy host's CPU lacks the
   AVX instructions `mongodb-memory-server` needs). If the app can't boot,
   **pm2 is not restarted** — better to keep serving the previous version than
   start crash-looping.
5. `pm2 restart chahrity-api`, waits 5s, then checks `pm2 jlist` reports status
   `online`. Error logs are *not* scraped: non-fatal startup warnings produced
   too many false positives.
6. Hits `https://api.chahrity.com/api/health` from the server. Aborts unless it returns 200.

Ordering matters: steps 3 and 4 both run **before** the restart, so any failure
leaves the previous version serving traffic with no downtime.

### Deploy order when the frontend needs new endpoints

Netlify builds on push, and the backend is deployed by hand, so pushing both at
once means the frontend can go live minutes before the API it depends on. That
window shows up as 404s from the new UI. When a release adds endpoints:

```bash
git push origin <backend-commit>:main     # backend first
ssh <server> "cd ~/finance-app && bash scripts/deploy-remote.sh"
git push origin main                      # then the frontend
```

Override via env vars if needed:
```bash
APP_DIR=/srv/finance-app PM2_APP=chahrity-prod bash scripts/deploy-remote.sh
```

### Why this exists

On 2026-06-07, a `uuid` v13 dependency bump (ESM-only) silently crash-looped the production backend for hours. Nobody knew until the founder's dad couldn't log in. The script encodes the lessons:

- Don't pull on top of stale server edits (we had that problem too — the server had local hotfix edits that blocked the pull).
- Don't restart unless the app can actually boot (smoke test catches `ERR_REQUIRE_ESM` in ~50ms).
- Don't trust pm2 status — verify the **public** endpoint answers.

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
3. `npm install` in `backend/`.
4. Runs the boot smoke test (`backend/tests/smoke.test.js`). If the app can't boot, **pm2 is not restarted** — better to keep serving the previous version than start crash-looping.
5. `pm2 restart chahrity-api`, waits 3s, scans error log for `ERR_*` or `Error [` patterns. Aborts if any new boot errors appear.
6. Hits `https://api.chahrity.com/api/health` from the server. Aborts unless it returns 200.

Override via env vars if needed:
```bash
APP_DIR=/srv/finance-app PM2_APP=chahrity-prod bash scripts/deploy-remote.sh
```

### Why this exists

On 2026-06-07, a `uuid` v13 dependency bump (ESM-only) silently crash-looped the production backend for hours. Nobody knew until the founder's dad couldn't log in. The script encodes the lessons:

- Don't pull on top of stale server edits (we had that problem too — the server had local hotfix edits that blocked the pull).
- Don't restart unless the app can actually boot (smoke test catches `ERR_REQUIRE_ESM` in ~50ms).
- Don't trust pm2 status — verify the **public** endpoint answers.

#!/usr/bin/env node
// Boot smoke test — does the app module load without throwing?
//
// Intentionally NOT a vitest test: we want this to run on minimal CPUs
// (the deploy target may not support the AVX instructions mongodb-memory-server
// requires, and there is no reason a boot test should touch a database).
//
// Exits 0 on success, non-zero on any error. Used by scripts/deploy-remote.sh.

try {
    const app = require('../src/app');
    if (typeof app !== 'function' || typeof app.use !== 'function') {
        console.error('FAIL: ../src/app did not export an Express handler');
        process.exit(1);
    }
    console.log('OK: backend boots');
    process.exit(0);
} catch (err) {
    console.error('FAIL: backend boot threw');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
}

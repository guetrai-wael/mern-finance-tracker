#!/usr/bin/env node
/* Minimal data-migration runner.
 *
 * There is no migration framework in this project and one is not warranted, but
 * an idempotency ledger is: without it, "did the backfill already run?" is
 * answered by guessing, and guessing wrong on financial data is expensive.
 *
 * Usage:
 *   node scripts/migrate.js              apply everything pending
 *   node scripts/migrate.js --dry-run    report what would change, write nothing
 *   node scripts/migrate.js --only=001-backfill-transaction-accounts
 *   node scripts/migrate.js --down=001-backfill-transaction-accounts
 *
 * Each file in scripts/migrations/ exports { name, up, down }. They export
 * FUNCTIONS rather than running on import, so the test suite can call them
 * directly against an in-memory database.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LEDGER = 'migrations';

const parseArgs = (argv) => {
    const args = { dryRun: false, only: null, down: null };
    for (const arg of argv.slice(2)) {
        if (arg === '--dry-run') args.dryRun = true;
        else if (arg.startsWith('--only=')) args.only = arg.slice('--only='.length);
        else if (arg.startsWith('--down=')) args.down = arg.slice('--down='.length);
        else {
            console.error(`Unknown argument: ${arg}`);
            process.exit(1);
        }
    }
    return args;
};

const loadMigrations = () => {
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith('.js'))
        .sort() // filename order is execution order
        .map((file) => {
            const migration = require(path.join(MIGRATIONS_DIR, file));
            if (!migration.name || typeof migration.up !== 'function') {
                throw new Error(`${file} must export { name, up, down }`);
            }
            return migration;
        });
};

async function main() {
    const args = parseArgs(process.argv);
    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.error('MONGO_URI is not set. Refusing to run.');
        process.exit(1);
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const ledger = db.collection(LEDGER);

    let failed = false;

    try {
        const migrations = loadMigrations();

        if (args.down) {
            const migration = migrations.find((m) => m.name === args.down);
            if (!migration) throw new Error(`No migration named ${args.down}`);
            if (typeof migration.down !== 'function') {
                throw new Error(`${migration.name} has no down()`);
            }

            const record = await ledger.findOne({ name: migration.name });
            if (!record) {
                console.log(`${migration.name} was never applied — nothing to roll back.`);
                return;
            }

            console.log(`Rolling back ${migration.name}...`);
            await migration.down({ db, mongoose, meta: record.meta || {} });
            await ledger.deleteOne({ name: migration.name });
            console.log(`Rolled back ${migration.name}.`);
            return;
        }

        const pending = [];
        for (const migration of migrations) {
            if (args.only && migration.name !== args.only) continue;
            const applied = await ledger.findOne({ name: migration.name });
            if (applied) {
                console.log(`- ${migration.name} (already applied ${applied.appliedAt.toISOString()})`);
                continue;
            }
            pending.push(migration);
        }

        if (pending.length === 0) {
            console.log('Nothing to do — all migrations are up to date.');
            return;
        }

        for (const migration of pending) {
            const startedAt = new Date();
            console.log(`\n${args.dryRun ? '[dry run] ' : ''}Running ${migration.name}...`);

            const meta = await migration.up({ db, mongoose, dryRun: args.dryRun });

            if (args.dryRun) {
                console.log(`[dry run] ${migration.name} would complete. Nothing was written to the ledger.`);
                continue;
            }

            // Ledger is written only after up() resolves. A migration that
            // throws leaves no record and will be retried on the next run.
            await ledger.insertOne({
                name: migration.name,
                startedAt,
                appliedAt: new Date(),
                meta: meta || {}
            });
            console.log(`Applied ${migration.name}.`);
        }
    } catch (err) {
        failed = true;
        console.error('\nMigration failed:', err.message);
        console.error(err.stack);
    } finally {
        await mongoose.disconnect();
    }

    process.exit(failed ? 1 : 0);
}

main();

#!/usr/bin/env node
/* Restore one collection from a backup taken by scripts/backup.js.
 *
 * Deliberately awkward to use. It replaces a collection's entire contents, so
 * it asks for the directory, the collection name, and an explicit --confirm.
 * Without --confirm it reports what it would do and exits without writing.
 *
 * One collection at a time on purpose: a whole-database restore is almost
 * never what you actually want, and being forced to name the collection makes
 * you think about which one is really wrong.
 *
 * Usage:
 *   node scripts/restore.js --from=backups/2026-07-26... --collection=transactions
 *   node scripts/restore.js --from=... --collection=transactions --confirm
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Must be the same EJSON instance backup.js wrote with — see the note there.
// require('bson') can resolve to a different major than mongoose's driver uses.
const { EJSON } = mongoose.mongo.BSON;

const parseArgs = (argv) => {
    const args = { from: null, collection: null, confirm: false };
    for (const arg of argv.slice(2)) {
        if (arg.startsWith('--from=')) args.from = arg.slice('--from='.length);
        else if (arg.startsWith('--collection=')) args.collection = arg.slice('--collection='.length);
        else if (arg === '--confirm') args.confirm = true;
        else {
            console.error(`Unknown argument: ${arg}`);
            process.exit(1);
        }
    }
    return args;
};

/**
 * Replace one collection's contents from a backup directory.
 * Exported for testing; see backup.js for why EJSON must come from mongoose.
 */
async function restoreCollection(db, { dir, collection: name, confirm = false, log = console.log }) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) {
        throw new Error(`No backup file at ${file}`);
    }

    const docs = EJSON.parse(fs.readFileSync(file, 'utf8'));
    const collection = db.collection(name);
    const current = await collection.countDocuments();

    log(`Collection : ${name}`);
    log(`In database: ${current} document(s)  <- will be DELETED`);
    log(`In backup  : ${docs.length} document(s)  <- will be inserted`);

    if (!confirm) {
        log('\nDry run. Nothing was changed. Re-run with --confirm to apply.');
        return { restored: 0, dryRun: true };
    }

    // deleteMany rather than drop() so indexes defined by the models survive.
    await collection.deleteMany({});
    if (docs.length > 0) {
        await collection.insertMany(docs, { ordered: false });
    }

    const restored = await collection.countDocuments();
    if (restored !== docs.length) {
        throw new Error(`Restored ${restored} documents but the backup held ${docs.length}.`);
    }

    return { restored, dryRun: false };
}

async function main() {
    const args = parseArgs(process.argv);
    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.error('MONGO_URI is not set. Refusing to run.');
        process.exit(1);
    }
    if (!args.from || !args.collection) {
        console.error('Usage: node scripts/restore.js --from=<dir> --collection=<name> [--confirm]');
        process.exit(1);
    }

    await mongoose.connect(uri);
    let failed = false;

    try {
        const result = await restoreCollection(mongoose.connection.db, {
            dir: args.from,
            collection: args.collection,
            confirm: args.confirm
        });

        if (!result.dryRun) {
            console.log(`\nRestored ${result.restored} document(s) into ${args.collection}.`);
        }
    } catch (err) {
        failed = true;
        console.error('\nRestore failed:', err.message);
        console.error(err.stack);
    } finally {
        await mongoose.disconnect();
    }

    process.exit(failed ? 1 : 0);
}

module.exports = { restoreCollection };

if (require.main === module) main();

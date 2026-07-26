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
const { EJSON } = require('bson');
require('dotenv').config();

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

    const file = path.join(args.from, `${args.collection}.json`);
    if (!fs.existsSync(file)) {
        console.error(`No backup file at ${file}`);
        process.exit(1);
    }

    const docs = EJSON.parse(fs.readFileSync(file, 'utf8'));

    await mongoose.connect(uri);
    let failed = false;

    try {
        const collection = mongoose.connection.db.collection(args.collection);
        const current = await collection.countDocuments();

        console.log(`Collection : ${args.collection}`);
        console.log(`In database: ${current} document(s)  <- will be DELETED`);
        console.log(`In backup  : ${docs.length} document(s)  <- will be inserted`);

        if (!args.confirm) {
            console.log('\nDry run. Nothing was changed. Re-run with --confirm to apply.');
            return;
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

        console.log(`\nRestored ${restored} document(s) into ${args.collection}.`);
    } catch (err) {
        failed = true;
        console.error('\nRestore failed:', err.message);
        console.error(err.stack);
    } finally {
        await mongoose.disconnect();
    }

    process.exit(failed ? 1 : 0);
}

main();

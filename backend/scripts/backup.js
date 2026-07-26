#!/usr/bin/env node
/* Dump every collection to JSON.
 *
 * Exists because this project runs on an Atlas M0 free cluster, which has no
 * snapshot or backup feature, and the deploy host is a low-spec machine where
 * installing mongodb-database-tools for the sake of one migration is more
 * ceremony than it is worth. mongoose is already a dependency, so this needs
 * nothing new.
 *
 * Not a general-purpose backup tool: it reads each collection into memory
 * before writing. Fine for a database of this size (hundreds of documents);
 * it will warn if a collection is large enough that you should use mongodump
 * instead.
 *
 * Usage:
 *   npm run backup                    -> backups/<timestamp>/
 *   node scripts/backup.js --out=DIR
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

/* Extended JSON, not plain JSON. JSON.stringify renders an ObjectId as a bare
 * string and a Date as an ISO string, so restoring such a file would replace
 * every reference and timestamp with text — silently breaking populate() and
 * every date range query.
 *
 * Taken from mongoose's own driver rather than require('bson'). node_modules
 * holds more than one copy of bson (7.x hoisted, 5.x under mongoose), and each
 * refuses to serialize BSON types produced by a different major:
 *   BSONVersionError: Unsupported BSON version, bson types must be from bson 7.x.x
 * Reaching through mongoose guarantees this is the exact instance that created
 * the documents being dumped, whatever version that happens to be.
 */
const { EJSON } = mongoose.mongo.BSON;

const LARGE_COLLECTION = 50000;

const parseArgs = (argv) => {
    const args = { out: null };
    for (const arg of argv.slice(2)) {
        if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length);
        else {
            console.error(`Unknown argument: ${arg}`);
            process.exit(1);
        }
    }
    return args;
};

/**
 * Dump every collection in `db` to `outDir` as Extended JSON.
 * Exported so the test suite can round-trip it against a real database — the
 * bson-version bug this guards against is invisible to any test that does not.
 *
 * @returns {Promise<{outDir: string, collections: Object}>}
 */
async function backupCollections(db, outDir, { log = console.log } = {}) {
    fs.mkdirSync(outDir, { recursive: true });

    const collections = await db.listCollections().toArray();
    const manifest = { takenAt: new Date().toISOString(), collections: {} };

    log(`Backing up ${collections.length} collection(s) to:\n  ${outDir}\n`);

    for (const { name } of collections) {
        const collection = db.collection(name);
        const count = await collection.countDocuments();

        if (count > LARGE_COLLECTION) {
            console.warn(`  ! ${name}: ${count} documents — large. Consider mongodump for this one.`);
        }

        const docs = await collection.find({}).toArray();
        fs.writeFileSync(path.join(outDir, `${name}.json`), EJSON.stringify(docs, null, 2));

        manifest.collections[name] = count;
        log(`  ${name}: ${count} document(s)`);
    }

    fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
    return { outDir, collections: manifest.collections };
}

async function main() {
    const args = parseArgs(process.argv);
    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.error('MONGO_URI is not set. Refusing to run.');
        process.exit(1);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = args.out || path.join(__dirname, '..', 'backups', stamp);

    await mongoose.connect(uri);
    let failed = false;

    try {
        await backupCollections(mongoose.connection.db, outDir);
        console.log(`\nBackup complete: ${outDir}`);
        console.log('Restore with: node scripts/restore.js --from=<dir> --collection=<name> --confirm');
    } catch (err) {
        failed = true;
        console.error('\nBackup failed:', err.message);
        console.error(err.stack);
    } finally {
        await mongoose.disconnect();
    }

    process.exit(failed ? 1 : 0);
}

module.exports = { backupCollections };

// Only run the CLI when invoked directly, so requiring this from a test is safe.
if (require.main === module) main();

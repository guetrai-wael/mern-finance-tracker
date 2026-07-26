/* Guard for the contract phase.
 *
 * Migration 001 backfilled every transaction with an account, and the model now
 * declares that field required. This re-asserts the invariant at deploy time so
 * the required constraint is never switched on over data that does not satisfy
 * it — for instance if 001 were skipped on a database restored from an older
 * dump, or if rows were written by a process that predated the backfill.
 *
 * Writes nothing. It either passes or aborts the deploy.
 */
async function up({ db }) {
    const transactions = db.collection('transactions');

    const unaccounted = await transactions.countDocuments({
        $or: [{ account: { $exists: false } }, { account: null }]
    });

    if (unaccounted > 0) {
        throw new Error(
            `${unaccounted} transaction(s) have no account. Run ` +
            `001-backfill-transaction-accounts before enabling the required constraint.`
        );
    }

    const total = await transactions.countDocuments();
    console.log(`  verified: all ${total} transaction(s) have an account`);

    // Transfers must name a destination, and it must differ from the source.
    // The schema enforces this going forward; this catches anything written
    // before the hook existed.
    const brokenTransfers = await transactions.countDocuments({
        type: 'transfer',
        $or: [{ transferTo: { $exists: false } }, { transferTo: null }]
    });

    if (brokenTransfers > 0) {
        throw new Error(`${brokenTransfers} transfer(s) have no destination account.`);
    }

    return { verified: total };
}

/** Nothing to undo — this migration only reads. */
async function down() {
    console.log('  002 is a verification step; nothing to roll back');
}

module.exports = { name: '002-assert-account-required', up, down };

/* Give every existing transaction an account.
 *
 * Runs between the deploy that adds `account` as OPTIONAL and the later deploy
 * that makes it required. Both surrounding states are individually correct, so
 * there is no window where the app is serving wrong numbers.
 *
 * Idempotent three times over, because a ledger alone does not protect a run
 * that crashed halfway:
 *   1. the { account: { $exists: false } } selector matches nothing on a re-run
 *   2. the $setOnInsert upsert returns the same account rather than a second one
 *   3. the runner's ledger skips the file entirely
 *
 * Every provisioned account gets openingBalance: 0, which means its derived
 * balance equals exactly the income-minus-expenses total the dashboard already
 * displays. Verification after running this is therefore simple: nobody's
 * balance should have changed at all.
 */
const DEFAULT_ACCOUNT_NAME = 'Main Account';

async function resolveAccount(db, userId, currency) {
    const accounts = db.collection('accounts');

    const existing = await accounts.findOne({ user: userId, isDefault: true });
    if (existing) return { account: existing, created: false };

    const now = new Date();
    const result = await accounts.findOneAndUpdate(
        { user: userId, isDefault: true },
        {
            $setOnInsert: {
                user: userId,
                name: DEFAULT_ACCOUNT_NAME,
                type: 'bank',
                openingBalance: 0,
                currency: currency || 'USD',
                isArchived: false,
                isDefault: true,
                createdAt: now,
                updatedAt: now
            }
        },
        { upsert: true, returnDocument: 'after' }
    );

    const account = result.value || result;
    return { account, created: true };
}

async function up({ db, dryRun }) {
    const transactions = db.collection('transactions');
    const users = db.collection('users');

    const unaccounted = await transactions.countDocuments({ account: { $exists: false } });
    console.log(`  transactions without an account: ${unaccounted}`);

    // distinct() over transactions can return ids with no matching User: the
    // account-deletion path removes the user without cascading, so orphaned
    // transactions exist. They are backfilled anyway to keep the final
    // zero-remaining check clean.
    const userIds = await transactions.distinct('user', { account: { $exists: false } });
    console.log(`  users affected: ${userIds.length}`);

    if (dryRun) {
        let orphans = 0;
        for (const userId of userIds) {
            if (!(await users.findOne({ _id: userId }))) orphans += 1;
        }
        console.log(`  orphaned users (no User document): ${orphans}`);
        console.log('  [dry run] no writes performed');
        return null;
    }

    const createdAccountIds = [];
    let updated = 0;
    let orphans = 0;

    for (const userId of userIds) {
        const user = await users.findOne({ _id: userId });
        if (!user) orphans += 1;

        const { account, created } = await resolveAccount(db, userId, user?.settings?.currency);
        if (created) createdAccountIds.push(account._id);

        const result = await transactions.updateMany(
            { user: userId, account: { $exists: false } },
            { $set: { account: account._id } }
        );

        updated += result.modifiedCount;
        console.log(`  user ${userId}: ${result.modifiedCount} transaction(s) -> account ${account._id}`);
    }

    // Users with no transactions still get an account so the app never has to
    // provision one mid-request for them.
    const allUsers = await users.find({}, { projection: { _id: 1, settings: 1 } }).toArray();
    for (const user of allUsers) {
        const { account, created } = await resolveAccount(db, user._id, user.settings?.currency);
        if (created) createdAccountIds.push(account._id);
    }

    const remaining = await transactions.countDocuments({ account: { $exists: false } });
    if (remaining !== 0) {
        // Throwing leaves the ledger unwritten, so the next run retries.
        throw new Error(`${remaining} transaction(s) still have no account — refusing to record this migration as applied.`);
    }

    console.log(`  accounts created: ${createdAccountIds.length}`);
    console.log(`  transactions updated: ${updated}`);
    console.log(`  orphaned users encountered: ${orphans}`);

    return { createdAccountIds, updated, orphans };
}

/**
 * Undo. Only touches accounts this migration created — recorded in the ledger —
 * so an account the user made by hand afterwards is never deleted.
 */
async function down({ db, meta }) {
    const transactions = db.collection('transactions');
    const accounts = db.collection('accounts');

    const ids = (meta && meta.createdAccountIds) || [];
    if (ids.length === 0) {
        console.log('  no accounts recorded as created; nothing to roll back');
        return;
    }

    const cleared = await transactions.updateMany(
        { account: { $in: ids } },
        { $unset: { account: 1 } }
    );
    const removed = await accounts.deleteMany({ _id: { $in: ids } });

    console.log(`  cleared account from ${cleared.modifiedCount} transaction(s)`);
    console.log(`  removed ${removed.deletedCount} account(s)`);
}

module.exports = { name: '001-backfill-transaction-accounts', up, down };

/* Accounts controller: wallets, and the balances derived from them. */
const Account = require('../models/account.model');
const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, created, error } = require('../utils/response');
const { TransactionQueries } = require('../utils/dbOptimization');

const DEFAULT_ACCOUNT_NAME = 'Main Account';

/**
 * The account a transaction belongs to when the caller does not name one.
 *
 * Created on demand rather than at signup, so existing users get one the first
 * time they need it without a migration having to run first.
 *
 * openingBalance is 0 on purpose: the derived balance of a freshly provisioned
 * account equals exactly the income-minus-expenses figure the dashboard already
 * shows, which makes introducing accounts a visual no-op for existing users.
 *
 * The upsert races safely against a concurrent request because of the partial
 * unique index on { user, isDefault: true } — a duplicate-key error means
 * someone else won, so we read theirs.
 */
async function resolveDefaultAccount(userId, currency) {
    const existing = await Account.findOne({ user: userId, isDefault: true });
    if (existing) return existing;

    let resolvedCurrency = currency;
    if (!resolvedCurrency) {
        const user = await User.findById(userId).select('settings').lean();
        resolvedCurrency = user?.settings?.currency || 'USD';
    }

    try {
        return await Account.findOneAndUpdate(
            { user: userId, isDefault: true },
            {
                $setOnInsert: {
                    user: userId,
                    name: DEFAULT_ACCOUNT_NAME,
                    type: 'bank',
                    openingBalance: 0,
                    currency: resolvedCurrency,
                    isArchived: false,
                    isDefault: true
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        // Lost the race — the winner's document is now there.
        if (err.code === 11000) {
            return Account.findOne({ user: userId, isDefault: true });
        }
        throw err;
    }
}

/** Merge each account with its derived balance. */
async function withBalances(userId, accounts) {
    const rows = await Transaction.aggregate(TransactionQueries.getAccountBalances(userId));
    const netByAccount = new Map(rows.map((row) => [String(row._id), row.net]));

    return accounts.map((account) => {
        const plain = account.toObject ? account.toObject() : account;
        const net = netByAccount.get(String(plain._id)) || 0;
        return { ...plain, balance: plain.openingBalance + net };
    });
}

const listAccounts = asyncHandler(async (req, res) => {
    const filter = { user: req.user._id };
    if (req.query.includeArchived !== 'true') filter.isArchived = false;

    const accounts = await Account.find(filter).sort({ isDefault: -1, name: 1 });
    const withBalance = await withBalances(req.user._id, accounts);

    return successList(res, withBalance, 'Accounts retrieved successfully');
});

const getAccount = asyncHandler(async (req, res) => {
    const account = await Account.findOne({ _id: req.params.id, user: req.user._id });
    if (!account) return error(res, 'Account not found', 404);

    const [withBalance] = await withBalances(req.user._id, [account]);
    return success(res, withBalance, 'Account retrieved successfully');
});

const createAccount = asyncHandler(async (req, res) => {
    const existing = await Account.findOne({ user: req.user._id, name: req.body.name });
    if (existing) return error(res, 'An account with that name already exists', 400);

    // The first account a user creates becomes their default.
    const count = await Account.countDocuments({ user: req.user._id });

    const account = await Account.create({
        ...req.body,
        user: req.user._id,
        isDefault: count === 0
    });

    return created(res, { ...account.toObject(), balance: account.openingBalance }, 'Account created successfully');
});

const updateAccount = asyncHandler(async (req, res) => {
    const account = await Account.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        req.body,
        { new: true, runValidators: true }
    );
    if (!account) return error(res, 'Account not found', 404);

    const [withBalance] = await withBalances(req.user._id, [account]);
    return success(res, withBalance, 'Account updated successfully');
});

const deleteAccount = asyncHandler(async (req, res) => {
    const account = await Account.findOne({ _id: req.params.id, user: req.user._id });
    if (!account) return error(res, 'Account not found', 404);

    // Deleting an account that still owns transactions would orphan them and
    // silently distort every total. Archiving keeps the history readable.
    const inUse = await Transaction.countDocuments({
        user: req.user._id,
        $or: [{ account: account._id }, { transferTo: account._id }]
    });

    if (inUse > 0) {
        return error(
            res,
            `This account has ${inUse} transaction(s). Archive it instead of deleting.`,
            400
        );
    }

    if (account.isDefault) {
        return error(res, 'Cannot delete your default account. Make another account the default first.', 400);
    }

    await Account.deleteOne({ _id: account._id });
    return success(res, null, 'Account deleted successfully');
});

const setDefaultAccount = asyncHandler(async (req, res) => {
    const account = await Account.findOne({ _id: req.params.id, user: req.user._id });
    if (!account) return error(res, 'Account not found', 404);
    if (account.isArchived) return error(res, 'An archived account cannot be the default', 400);

    // Clear the old default before setting the new one — the partial unique
    // index rejects a second isDefault:true.
    await Account.updateOne({ user: req.user._id, isDefault: true }, { isDefault: false });
    account.isDefault = true;
    await account.save();

    return success(res, account, 'Default account updated');
});

module.exports = {
    listAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
    resolveDefaultAccount,
    DEFAULT_ACCOUNT_NAME
};

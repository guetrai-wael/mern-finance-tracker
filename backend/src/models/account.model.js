/* Account model: a wallet, bank account, card, or cash pile.
 *
 * Balance is deliberately NOT stored here. It is derived on read from
 * openingBalance plus the transactions that reference the account — see
 * TransactionQueries.getAccountBalances. A stored counter would need a
 * read-modify-write on every transaction create, update, and delete, and when
 * it drifted nobody would notice, because nobody remembers what their balance
 * was supposed to be.
 */
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['cash', 'bank', 'card', 'savings'],
        default: 'bank'
    },
    // Money already in the account before the first recorded transaction.
    openingBalance: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    isArchived: { type: Boolean, default: false },
    // The account transactions fall back to when none is specified. Exactly one
    // per user, enforced by the partial unique index below.
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

accountSchema.index({ user: 1, isArchived: 1 }); // Active account list
accountSchema.index({ user: 1, name: 1 }, { unique: true }); // No duplicate names

// Exactly one default per user. A partial index is what makes
// resolveDefaultAccount safe against a concurrent signup: the loser of an
// upsert race gets a duplicate-key error rather than creating a second default.
accountSchema.index(
    { user: 1, isDefault: 1 },
    { unique: true, partialFilterExpression: { isDefault: true } }
);

module.exports = mongoose.model('Account', accountSchema);

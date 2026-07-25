/* Recurring transactions controller: rules that auto-post transactions.
 *
 * The rules only describe *when* something should post. The posting itself is
 * done by jobs/postRecurring.js, so nothing here creates a Transaction.
 */
const RecurringTransaction = require('../models/recurringTransaction.model');
const Transaction = require('../models/transaction.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, created, error } = require('../utils/response');
const { firstDueOnOrAfter } = require('../jobs/recurrence');

const listRecurring = asyncHandler(async (req, res) => {
    const rules = await RecurringTransaction.find({ user: req.user._id })
        .populate('category')
        .sort({ isActive: -1, nextDue: 1 });
    return successList(res, rules, 'Recurring transactions retrieved successfully');
});

const createRecurring = asyncHandler(async (req, res) => {
    const startDate = new Date(req.body.startDate);

    // A rule created with a start date in the past begins at its next future
    // occurrence rather than backfilling history the user never recorded.
    const nextDue = firstDueOnOrAfter(startDate, req.body.frequency, new Date(), {
        dayOfMonth: req.body.dayOfMonth
    });

    const rule = await RecurringTransaction.create({
        ...req.body,
        user: req.user._id,
        startDate,
        nextDue
    });

    return created(res, rule, 'Recurring transaction created successfully');
});

const updateRecurring = asyncHandler(async (req, res) => {
    const rule = await RecurringTransaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!rule) return error(res, 'Recurring transaction not found', 404);

    Object.assign(rule, req.body);

    // Changing the cadence or anchor invalidates the stored nextDue, so
    // recompute it from the (possibly new) start date.
    if (req.body.frequency || req.body.startDate || req.body.dayOfMonth !== undefined) {
        rule.nextDue = firstDueOnOrAfter(rule.startDate, rule.frequency, new Date(), {
            dayOfMonth: rule.dayOfMonth
        });
    }

    await rule.save();
    return success(res, rule, 'Recurring transaction updated successfully');
});

const deleteRecurring = asyncHandler(async (req, res) => {
    const rule = await RecurringTransaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!rule) return error(res, 'Recurring transaction not found', 404);
    return success(res, null, 'Recurring transaction deleted successfully');
});

/**
 * Delete every transaction this rule generated.
 *
 * The escape hatch for a misconfigured rule: because generated transactions
 * carry recurringId, a bad rule can be undone in one call instead of the user
 * hunting down entries by hand.
 */
const undoGenerated = asyncHandler(async (req, res) => {
    const rule = await RecurringTransaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!rule) return error(res, 'Recurring transaction not found', 404);

    const result = await Transaction.deleteMany({ user: req.user._id, recurringId: rule._id });

    return success(res, { deleted: result.deletedCount }, 'Generated transactions removed');
});

module.exports = { listRecurring, createRecurring, updateRecurring, deleteRecurring, undoGenerated };

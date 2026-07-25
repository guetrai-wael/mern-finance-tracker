/* Notification dispatch.
 *
 * The single choke point for delivering an alert. Everything that wants to
 * notify a user goes through dispatch(), which means:
 *   - preference checks happen in exactly one place
 *   - deduplication happens in exactly one place
 *   - adding email later is a change to ONE function, not to every trigger
 */
const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');

// Which preference toggle governs which notification type.
const PREFERENCE_FOR_TYPE = {
    budget: 'budgetAlerts',
    goal: 'goalReminders',
    report: 'monthlyReports',
    system: null // system notices are not opt-out
};

/**
 * True when the user wants this type of notification.
 * Defaults to allowed when preferences are missing — a user who has never
 * touched settings should still receive alerts.
 */
function isEnabled(user, type) {
    const preference = PREFERENCE_FOR_TYPE[type];
    if (!preference) return true;

    const notifications = user?.settings?.notifications;
    if (!notifications) return true;

    return notifications[preference] !== false;
}

/**
 * Deliver a notification, honouring preferences and suppressing duplicates.
 *
 * @param {Object|ObjectId} userOrId  a User document if you already have one
 *   (saves a lookup), otherwise an id
 * @param {Object} payload { type, title, body, meta, dedupeKey }
 * @returns {Promise<Notification|null>} the notification, or null when it was
 *   suppressed by preference or already existed
 */
async function dispatch(userOrId, { type, title, body, meta = {}, dedupeKey }) {
    try {
        const user = userOrId && userOrId.settings !== undefined
            ? userOrId
            : await User.findById(userOrId).select('settings');

        if (!user) return null;
        if (!isEnabled(user, type)) return null;

        const userId = user._id || userOrId;

        // Upsert on (user, dedupeKey). $setOnInsert means a repeat trigger
        // neither creates a duplicate nor resurfaces something already read.
        const result = await Notification.findOneAndUpdate(
            { user: userId, dedupeKey },
            { $setOnInsert: { user: userId, dedupeKey, type, title, body, meta, read: false } },
            { upsert: true, new: false, setDefaultsOnInsert: true, rawResult: true }
        );

        // new: false returns the pre-existing doc, so a null value means we
        // just inserted. That distinction is what callers use to know whether
        // an alert actually fired.
        const wasCreated = !result.value;

        if (wasCreated) {
            logger.info('Notification dispatched', { userId, type, dedupeKey });
            // Email delivery hooks in here once a provider is configured,
            // gated on user.settings.notifications.email.
        }

        return wasCreated ? await Notification.findOne({ user: userId, dedupeKey }) : null;
    } catch (err) {
        // Never let a notification failure break the action that triggered it.
        logger.error('Notification dispatch failed', { error: err.message, dedupeKey, stack: err.stack });
        return null;
    }
}

/** Turn budgetCheck events into notifications. */
async function dispatchBudgetEvents(userOrId, events, { formatAmount = (n) => n.toFixed(2) } = {}) {
    const created = [];

    for (const event of events) {
        const isCategory = event.scope === 'category';
        const exceeded = event.level === 'exceeded';
        const percent = event.limit > 0 ? Math.round((event.spent / event.limit) * 100) : 0;

        const scopeLabel = isCategory ? event.categoryName : 'your monthly budget';
        const dedupeKey = isCategory
            ? `budget:${event.level}:${event.month}:cat:${event.categoryId}`
            : `budget:${event.level}:${event.month}:total`;

        const notification = await dispatch(userOrId, {
            type: 'budget',
            title: exceeded
                ? `Over budget${isCategory ? ` — ${event.categoryName}` : ''}`
                : `Approaching limit${isCategory ? ` — ${event.categoryName}` : ''}`,
            body: exceeded
                ? `You've spent ${formatAmount(event.spent)} of ${formatAmount(event.limit)} on ${scopeLabel} (${percent}%).`
                : `You're at ${percent}% of ${formatAmount(event.limit)} on ${scopeLabel}.`,
            meta: { href: '/budgets', month: event.month, scope: event.scope, spent: event.spent, limit: event.limit },
            dedupeKey
        });

        if (notification) created.push(notification);
    }

    return created;
}

module.exports = { dispatch, dispatchBudgetEvents, isEnabled };

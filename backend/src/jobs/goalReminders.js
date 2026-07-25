/* Nudges users about goals whose target date is approaching.
 *
 * Idempotent through the dedupeKey: a goal only ever produces one 30-day and
 * one 7-day reminder, no matter how often this runs.
 */
const Goal = require('../models/goal.model');
const { dispatch } = require('../services/notifications');

const DAY_MS = 24 * 60 * 60 * 1000;

// Windows to warn at, NARROWEST first. find() returns the first match, so this
// order is what picks the tightest applicable window: a goal 5 days out must
// resolve to 7d, not 30d. Widest-first would match 30 for every goal and the
// 7-day reminder would never fire.
const WINDOWS = [7, 30];

async function goalReminders(now = new Date()) {
    let sent = 0;

    const goals = await Goal.find({
        isCompleted: false,
        targetDate: { $ne: null, $gte: now }
    }).populate('user', 'settings');

    for (const goal of goals) {
        if (!goal.targetDate || !goal.user) continue;

        const daysLeft = Math.ceil((goal.targetDate.getTime() - now.getTime()) / DAY_MS);
        const window = WINDOWS.find((w) => daysLeft <= w);
        if (!window) continue;

        const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
        if (remaining === 0) continue; // funded, just not marked complete

        const notification = await dispatch(goal.user, {
            type: 'goal',
            title: `${goal.name} is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
            body: `${remaining.toFixed(2)} still to go toward your ${goal.targetAmount.toFixed(2)} target.`,
            meta: { href: '/goals', goalId: goal._id, daysLeft, remaining },
            dedupeKey: `goal:reminder:${goal._id}:${window}d`
        });

        if (notification) sent += 1;
    }

    return { sent, goalsChecked: goals.length };
}

module.exports = goalReminders;

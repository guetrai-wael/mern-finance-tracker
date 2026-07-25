/* Sends each user a summary of the month that just ended.
 *
 * Runs daily rather than on a month boundary: the dedupeKey carries the month,
 * so the first run after rollover sends it and every later run that day is a
 * no-op. That also means a server that was down on the 1st still delivers the
 * report when it comes back, instead of skipping the month entirely.
 */
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const { dispatch } = require('../services/notifications');

const previousMonthKey = (now) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return d.toISOString().slice(0, 7);
};

const monthBounds = (month) => {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
};

async function monthlyReport(now = new Date()) {
    const month = previousMonthKey(now);
    const { start, end } = monthBounds(month);

    // One aggregation for everybody, rather than a query per user.
    const totals = await Transaction.aggregate([
        { $match: { date: { $gte: start, $lt: end }, type: { $in: ['income', 'expense'] } } },
        { $group: { _id: { user: '$user', type: '$type' }, total: { $sum: '$amount' } } }
    ]);

    const byUser = new Map();
    for (const row of totals) {
        const key = String(row._id.user);
        const entry = byUser.get(key) || { income: 0, expense: 0 };
        entry[row._id.type] = row.total;
        byUser.set(key, entry);
    }

    if (byUser.size === 0) return { sent: 0, usersWithActivity: 0 };

    const users = await User.find({ _id: { $in: [...byUser.keys()] } }).select('settings');
    let sent = 0;

    for (const user of users) {
        const { income, expense } = byUser.get(String(user._id));
        const net = income - expense;

        const notification = await dispatch(user, {
            type: 'report',
            title: `Your ${month} summary`,
            body: `Income ${income.toFixed(2)}, spending ${expense.toFixed(2)}, ${net >= 0 ? 'saved' : 'overspent by'} ${Math.abs(net).toFixed(2)}.`,
            meta: { href: '/reports', month, income, expense, net },
            dedupeKey: `report:monthly:${month}`
        });

        if (notification) sent += 1;
    }

    return { sent, usersWithActivity: byUser.size };
}

module.exports = monthlyReport;

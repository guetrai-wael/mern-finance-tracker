/* Job registration. Imported once from src/index.js after the DB connects. */
const scheduler = require('./scheduler');
const postRecurring = require('./postRecurring');
const goalReminders = require('./goalReminders');
const monthlyReport = require('./monthlyReport');

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;

function registerJobs() {
    // Every 15 minutes is well inside the finest supported cadence (daily), so
    // a rule is never more than a few minutes late.
    scheduler.register('postRecurring', postRecurring, FIFTEEN_MINUTES);

    // These two are naturally daily. Running them more often is harmless — both
    // are deduped by key — and it means a restart re-checks promptly rather
    // than waiting a full day.
    scheduler.register('goalReminders', goalReminders, SIX_HOURS);
    scheduler.register('monthlyReport', monthlyReport, SIX_HOURS);
}

module.exports = { registerJobs, scheduler };

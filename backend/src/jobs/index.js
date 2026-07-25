/* Job registration. Imported once from src/index.js after the DB connects. */
const scheduler = require('./scheduler');
const postRecurring = require('./postRecurring');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function registerJobs() {
    // Every 15 minutes is well inside the finest supported cadence (daily), so
    // a rule is never more than a few minutes late.
    scheduler.register('postRecurring', postRecurring, FIFTEEN_MINUTES);
}

module.exports = { registerJobs, scheduler };

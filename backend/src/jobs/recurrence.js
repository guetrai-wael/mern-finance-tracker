/* Recurrence date arithmetic.
 *
 * Pure functions — no database, no Date.now(), no logging. Everything is
 * computed in UTC so results never shift with the server's timezone or DST.
 * Kept separate from the job runner so the tricky cases (month-end, leap years)
 * are directly testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days in a given UTC month. Handles leap years via day-0 rollback. */
function daysInMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Add months while clamping to the end of the target month.
 *
 * The trap this exists for: a rule anchored on the 31st must land on Feb 28
 * (or 29), not silently roll forward into March. Native Date arithmetic
 * overflows — `new Date(2026, 0, 31)` + 1 month yields March 3.
 */
function addMonthsClamped(date, months, anchorDay) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = anchorDay || date.getUTCDate();

    const targetMonthStart = new Date(Date.UTC(year, month + months, 1));
    const targetYear = targetMonthStart.getUTCFullYear();
    const targetMonth = targetMonthStart.getUTCMonth();

    const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));

    return new Date(Date.UTC(
        targetYear,
        targetMonth,
        clampedDay,
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds()
    ));
}

/**
 * Compute the next due date after `from`.
 *
 * @param {Date} from
 * @param {'daily'|'weekly'|'monthly'|'quarterly'|'yearly'} frequency
 * @param {Object} [opts]
 * @param {number} [opts.dayOfMonth] anchor day for monthly/quarterly/yearly.
 *   Preserves the original intent across short months: a rule for the 31st
 *   returns to the 31st after passing through February.
 * @returns {Date}
 */
function advance(from, frequency, opts = {}) {
    const date = new Date(from);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`advance: invalid date "${from}"`);
    }

    const { dayOfMonth } = opts;

    switch (frequency) {
        case 'daily':
            return new Date(date.getTime() + DAY_MS);
        case 'weekly':
            return new Date(date.getTime() + 7 * DAY_MS);
        case 'monthly':
            return addMonthsClamped(date, 1, dayOfMonth);
        case 'quarterly':
            return addMonthsClamped(date, 3, dayOfMonth);
        case 'yearly':
            return addMonthsClamped(date, 12, dayOfMonth);
        default:
            throw new Error(`advance: unsupported frequency "${frequency}"`);
    }
}

// Hard ceiling on any advance loop. A rule anchored years in the past must not
// spin; daily over ~5 years is the realistic worst case worth tolerating.
const MAX_ADVANCE_STEPS = 2000;

/**
 * First occurrence on or after `now`.
 *
 * Used when a rule is created with a start date in the past. Without this, a
 * user entering "rent, monthly, started Jan 2024" would immediately get two
 * years of backdated transactions dumped into their ledger. The catch-up loop
 * in the job runner exists for server downtime, not for inventing history the
 * user never recorded.
 */
function firstDueOnOrAfter(startDate, frequency, now, opts = {}) {
    let due = new Date(startDate);
    let steps = 0;

    while (due < now && steps < MAX_ADVANCE_STEPS) {
        due = advance(due, frequency, opts);
        steps += 1;
    }

    return due;
}

module.exports = { advance, addMonthsClamped, daysInMonth, firstDueOnOrAfter, MAX_ADVANCE_STEPS };

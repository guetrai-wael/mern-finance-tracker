/* Pure recurrence date arithmetic. No database — these run in microseconds.
 *
 * The month-end cases are the reason this module exists separately: native
 * Date arithmetic overflows Jan 31 + 1 month into March 3.
 */
const { advance, addMonthsClamped, daysInMonth } = require('../src/jobs/recurrence');

const utc = (iso) => new Date(iso);
const iso = (date) => date.toISOString();

describe('advance', () => {
    it('adds a day for daily', () => {
        expect(iso(advance(utc('2026-03-10T09:00:00.000Z'), 'daily'))).toEqual('2026-03-11T09:00:00.000Z');
    });

    it('adds seven days for weekly', () => {
        expect(iso(advance(utc('2026-03-10T09:00:00.000Z'), 'weekly'))).toEqual('2026-03-17T09:00:00.000Z');
    });

    it('adds a month for monthly', () => {
        expect(iso(advance(utc('2026-03-10T09:00:00.000Z'), 'monthly'))).toEqual('2026-04-10T09:00:00.000Z');
    });

    it('adds three months for quarterly', () => {
        expect(iso(advance(utc('2026-01-15T00:00:00.000Z'), 'quarterly'))).toEqual('2026-04-15T00:00:00.000Z');
    });

    it('adds a year for yearly', () => {
        expect(iso(advance(utc('2026-06-01T00:00:00.000Z'), 'yearly'))).toEqual('2027-06-01T00:00:00.000Z');
    });

    it('preserves the time of day', () => {
        expect(iso(advance(utc('2026-03-10T23:59:59.999Z'), 'monthly'))).toEqual('2026-04-10T23:59:59.999Z');
    });

    it('crosses a year boundary', () => {
        expect(iso(advance(utc('2026-12-15T00:00:00.000Z'), 'monthly'))).toEqual('2027-01-15T00:00:00.000Z');
    });

    it('rejects an unknown frequency', () => {
        expect(() => advance(utc('2026-01-01T00:00:00.000Z'), 'fortnightly')).toThrow(/unsupported frequency/);
    });

    it('rejects an invalid date', () => {
        expect(() => advance(new Date('nonsense'), 'daily')).toThrow(/invalid date/);
    });
});

describe('advance — month-end clamping', () => {
    it('clamps Jan 31 to Feb 28 in a common year', () => {
        // Native Date arithmetic would overflow this to March 3.
        expect(iso(advance(utc('2026-01-31T00:00:00.000Z'), 'monthly'))).toEqual('2026-02-28T00:00:00.000Z');
    });

    it('clamps Jan 31 to Feb 29 in a leap year', () => {
        expect(iso(advance(utc('2028-01-31T00:00:00.000Z'), 'monthly'))).toEqual('2028-02-29T00:00:00.000Z');
    });

    it('clamps the 31st to 30 in a thirty-day month', () => {
        expect(iso(advance(utc('2026-03-31T00:00:00.000Z'), 'monthly'))).toEqual('2026-04-30T00:00:00.000Z');
    });

    it('returns to the anchor day after a short month', () => {
        // Feb 28 was clamped from an anchor of 31 — March must go back to 31,
        // not stay stuck at 28 for the rest of the rule's life.
        expect(iso(advance(utc('2026-02-28T00:00:00.000Z'), 'monthly', { dayOfMonth: 31 })))
            .toEqual('2026-03-31T00:00:00.000Z');
    });

    it('clamps Feb 29 to Feb 28 across a leap year for yearly', () => {
        expect(iso(advance(utc('2028-02-29T00:00:00.000Z'), 'yearly'))).toEqual('2029-02-28T00:00:00.000Z');
    });

    it('clamps quarterly from Nov 30 anchored at 31', () => {
        expect(iso(advance(utc('2026-11-30T00:00:00.000Z'), 'quarterly', { dayOfMonth: 31 })))
            .toEqual('2027-02-28T00:00:00.000Z');
    });
});

describe('daysInMonth', () => {
    it('handles February in common and leap years', () => {
        expect(daysInMonth(2026, 1)).toEqual(28);
        expect(daysInMonth(2028, 1)).toEqual(29);
        expect(daysInMonth(2000, 1)).toEqual(29); // divisible by 400
        expect(daysInMonth(1900, 1)).toEqual(28); // divisible by 100, not 400
    });

    it('handles 30- and 31-day months', () => {
        expect(daysInMonth(2026, 3)).toEqual(30); // April
        expect(daysInMonth(2026, 0)).toEqual(31); // January
    });
});

describe('addMonthsClamped', () => {
    it('is stable when applied repeatedly with an anchor', () => {
        // A rule for the 31st walked across a full year must hit every
        // month-end correctly rather than drifting earlier over time.
        let date = utc('2026-01-31T00:00:00.000Z');
        const seen = [];

        for (let i = 0; i < 12; i += 1) {
            date = addMonthsClamped(date, 1, 31);
            seen.push(iso(date).slice(0, 10));
        }

        expect(seen).toEqual([
            '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31',
            '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30',
            '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31'
        ]);
    });
});

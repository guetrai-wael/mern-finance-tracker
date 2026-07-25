/* Regression tests for the security hardening pass.
 *
 * Each case here covers a fix for a defect that failed silently — the code
 * looked correct and the app behaved normally while the protection did nothing.
 * These assert the protection actually engages.
 */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const { recordValidationFailure, checkValidationRateLimit } = require('../src/middleware/validation');

const signup = (overrides = {}) =>
    request(app)
        .post('/api/v1/auth/signup')
        .send({
            name: 'Sec User',
            email: 'sec@example.com',
            password: 'Password123',
            ...overrides
        });

const cookiesFrom = (res) => res.headers['set-cookie'] || [];
const refreshCookie = (res) =>
    cookiesFrom(res).find((c) => c.startsWith('refreshToken='));

describe('validation rate limiter', () => {
    // The gate previously read a counter that nothing incremented, so it could
    // never trip no matter how many malformed requests arrived.
    it('increments a counter that the gate actually reads', () => {
        const req = { ip: '198.51.100.7', get: () => 'test-agent' };
        const next = () => {};

        // Drive it past the 50-failure threshold.
        for (let i = 0; i < 51; i += 1) {
            recordValidationFailure(req);
        }

        let blockedStatus = null;
        const res = {
            status(code) {
                blockedStatus = code;
                return this;
            },
            json() {
                return this;
            }
        };

        checkValidationRateLimit(req, res, next);
        expect(blockedStatus).toBe(429);
    });

    it('lets a fresh IP through', () => {
        const req = { ip: '198.51.100.8', get: () => 'test-agent' };
        let nexted = false;
        const res = {
            status() {
                return this;
            },
            json() {
                return this;
            }
        };

        checkValidationRateLimit(req, res, () => {
            nexted = true;
        });
        expect(nexted).toBe(true);
    });
});

describe('credential rate limiting', () => {
    // The old limiter allowed 500 auth requests per 5 minutes and was labelled
    // "DISABLED for development" in production code. This asserts the strict
    // limiter actually blocks.
    //
    // Toggling app.locals rather than process.env matters: vitest gives each
    // test file its own module registry but they share one process, so mutating
    // NODE_ENV here would switch limiters on for other files running alongside.
    beforeAll(() => {
        app.locals.rateLimits.enabled = true;
    });

    afterAll(() => {
        app.locals.rateLimits.enabled = false;
    });

    // Budget is per-IP and the store persists for the process lifetime, so each
    // case claims its own address via the Cloudflare header the keyGenerator reads.
    it('blocks after 10 failed login attempts', async () => {
        await signup({ email: 'bruteforce@example.com' });

        const attempt = () =>
            request(app)
                .post('/api/v1/auth/login')
                .set('cf-connecting-ip', '203.0.113.50')
                .send({ email: 'bruteforce@example.com', password: 'WrongPassword1' });

        const statuses = [];
        for (let i = 0; i < 12; i += 1) {
            const res = await attempt();
            statuses.push(res.statusCode);
        }

        expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
        expect(statuses.at(-1)).toEqual(429);
    });

    it('does not spend budget on successful logins', async () => {
        await signup({ email: 'goodactor@example.com' });

        // Well past the 10-attempt limit, but all succeed, so none are counted.
        for (let i = 0; i < 12; i += 1) {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .set('cf-connecting-ip', '203.0.113.51')
                .send({ email: 'goodactor@example.com', password: 'Password123' });
            expect(res.statusCode).toEqual(200);
        }
    });
});

describe('profile email normalization', () => {
    it('stores a mixed-case email lowercased', async () => {
        const created = await signup({ email: 'normalize@example.com' });
        const cookies = cookiesFrom(created);

        const res = await request(app)
            .put('/api/v1/auth/profile')
            .set('Cookie', cookies)
            .send({ email: 'MiXeDCase@Example.COM' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.email).toEqual('mixedcase@example.com');

        // And the stored record must match, so login lookups still resolve.
        const user = await User.findById(res.body.data._id || res.body.data.id);
        expect(user.email).toEqual('mixedcase@example.com');
    });

    it('rejects an email already held by another user regardless of case', async () => {
        await signup({ email: 'taken@example.com' });
        const second = await signup({ email: 'other@example.com' });

        const res = await request(app)
            .put('/api/v1/auth/profile')
            .set('Cookie', cookiesFrom(second))
            .send({ email: 'TAKEN@example.com' });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toMatch(/already in use/i);
    });
});

describe('password change invalidates other sessions', () => {
    it('rotates the stored refresh token', async () => {
        const created = await signup({ email: 'rotate@example.com' });
        const originalRefresh = refreshCookie(created);
        expect(originalRefresh).toBeDefined();

        const before = await User.findOne({ email: 'rotate@example.com' });
        const storedBefore = before.refreshToken;

        const res = await request(app)
            .put('/api/v1/auth/password')
            .set('Cookie', cookiesFrom(created))
            .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' });

        expect(res.statusCode).toEqual(200);

        const after = await User.findOne({ email: 'rotate@example.com' });
        // A stolen session holding the old refresh token is now dead.
        expect(after.refreshToken).not.toEqual(storedBefore);
        // The caller gets a working replacement so their own session survives.
        expect(refreshCookie(res)).toBeDefined();
    });

    it('refuses a weak new password', async () => {
        const created = await signup({ email: 'weak@example.com' });

        const res = await request(app)
            .put('/api/v1/auth/password')
            .set('Cookie', cookiesFrom(created))
            .send({ currentPassword: 'Password123', newPassword: 'short' });

        expect(res.statusCode).toEqual(400);
    });
});

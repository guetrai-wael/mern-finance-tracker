const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const { signAccess } = require('../src/utils/jwt');

describe('Access Control', () => {
    let inactiveCookie;
    let activeCookie;
    let expiredCookie;

    beforeEach(async () => {
        // Users creation

        const inactiveUser = await User.create({
            name: 'Inactive',
            email: 'inactive@test.com',
            password: 'pass',
            isActive: false
        });
        const inactiveToken = signAccess({ sub: inactiveUser._id, role: 'user' });
        inactiveCookie = `accessToken=${inactiveToken}`;

        const activeUser = await User.create({
            name: 'Active',
            email: 'active@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000) // Tomorrow
        });
        const activeToken = signAccess({ sub: activeUser._id, role: 'user' });
        activeCookie = `accessToken=${activeToken}`;

        const expiredUser = await User.create({
            name: 'Expired',
            email: 'expired@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: new Date(Date.now() - 86400000) // Yesterday
        });
        const expiredToken = signAccess({ sub: expiredUser._id, role: 'user' });
        expiredCookie = `accessToken=${expiredToken}`;
    });

    it('should block inactive user from accessing transactions', async () => {
        const res = await request(app)
            .get('/api/v1/transactions')
            .set('Cookie', [inactiveCookie]);

        expect(res.statusCode).toEqual(403);
        expect(res.body.errorType).toEqual('SUBSCRIPTION_REQUIRED');
    });

    it('should block expired user from accessing transactions', async () => {
        const res = await request(app)
            .get('/api/v1/transactions')
            .set('Cookie', [expiredCookie]);

        expect(res.statusCode).toEqual(403);
        expect(res.body.errorType).toEqual('SUBSCRIPTION_REQUIRED');
    });

    it('should allow active user to access transactions', async () => {
        const res = await request(app)
            .get('/api/v1/transactions')
            .set('Cookie', [activeCookie]);

        // Should be 200 (success) or 201 or 404 (no transactions), but definitely NOT 403
        expect(res.statusCode).not.toEqual(403);
    });

    it('should allow inactive user to access auth/me (profile)', async () => {
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Cookie', [inactiveCookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.isActive).toBe(false);
    });
});

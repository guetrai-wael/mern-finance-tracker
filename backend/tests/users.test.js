const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const { signAccess } = require('../src/utils/jwt');

describe('User Management (Admin)', () => {
    let adminCookie;
    let targetUser;

    beforeEach(async () => {
        const adminUser = await User.create({
            name: 'Admin',
            email: 'admin@test.com',
            password: 'pass',
            role: 'admin',
            isActive: true
        });
        const adminToken = signAccess({ sub: adminUser._id, role: 'admin' });
        adminCookie = `accessToken=${adminToken}`;

        targetUser = await User.create({
            name: 'Target',
            email: 'target@test.com',
            password: 'pass',
            isActive: false
        });
    });

    it('should allow admin to activate a user', async () => {
        const res = await request(app)
            .post(`/api/v1/users/${targetUser._id}/activate`)
            .set('Cookie', [adminCookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.isActive).toBe(true);
        expect(res.body.data.expiresAt).toBeDefined();

        // Verify in DB
        const updatedUser = await User.findById(targetUser._id);
        expect(updatedUser.isActive).toBe(true);
        expect(updatedUser.activatedAt).toBeDefined();
    });

    it('should allow admin to deactivate a user', async () => {
        const res = await request(app)
            .post(`/api/v1/users/${targetUser._id}/deactivate`)
            .set('Cookie', [adminCookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.isActive).toBe(false);

        // Verify in DB
        const updatedUser = await User.findById(targetUser._id);
        expect(updatedUser.isActive).toBe(false);
    });

    it('should extend an expired user by N days from now', async () => {
        // Set target to expired
        await User.updateOne(
            { _id: targetUser._id },
            { isActive: false, expiresAt: new Date(Date.now() - 86400000) }
        );

        const res = await request(app)
            .post(`/api/v1/users/${targetUser._id}/extend`)
            .set('Cookie', [adminCookie])
            .send({ days: 30 });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.isActive).toBe(true);

        const updated = await User.findById(targetUser._id);
        const expected = Date.now() + 30 * 86400000;
        expect(Math.abs(updated.expiresAt.getTime() - expected)).toBeLessThan(60_000);
    });

    it('should stack extensions onto a non-expired user', async () => {
        // Set target to expire in 5 days
        const fiveDaysFromNow = new Date(Date.now() + 5 * 86400000);
        await User.updateOne(
            { _id: targetUser._id },
            { isActive: true, expiresAt: fiveDaysFromNow }
        );

        const res = await request(app)
            .post(`/api/v1/users/${targetUser._id}/extend`)
            .set('Cookie', [adminCookie])
            .send({ days: 30 });

        expect(res.statusCode).toEqual(200);

        const updated = await User.findById(targetUser._id);
        // Should be ~5+30 = 35 days from now, not just 30
        const expected = fiveDaysFromNow.getTime() + 30 * 86400000;
        expect(Math.abs(updated.expiresAt.getTime() - expected)).toBeLessThan(60_000);
    });

    it('should reject extend with invalid days', async () => {
        const res = await request(app)
            .post(`/api/v1/users/${targetUser._id}/extend`)
            .set('Cookie', [adminCookie])
            .send({ days: 0 });

        expect(res.statusCode).toEqual(400);
    });
});

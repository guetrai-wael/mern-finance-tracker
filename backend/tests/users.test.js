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
});

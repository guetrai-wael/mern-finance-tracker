const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');

describe('Auth Endpoints', () => {
    it('should register a new user with an active 14-day trial', async () => {
        const res = await request(app)
            .post('/api/v1/auth/signup')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'Password123'
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.email).toEqual('test@example.com');
        expect(res.body.data.isActive).toBe(true);
        expect(res.body.data.expiresAt).toBeDefined();

        const user = await User.findOne({ email: 'test@example.com' });
        expect(user.isActive).toBe(true);
        // ~14 days from now (within 1 minute tolerance)
        const expectedExpiry = Date.now() + 14 * 24 * 60 * 60 * 1000;
        expect(Math.abs(user.expiresAt.getTime() - expectedExpiry)).toBeLessThan(60_000);
    });

    it('should still allow login for an admin-deactivated user but report inactive', async () => {
        // Sign up, then admin-deactivate by editing the model directly.
        await request(app)
            .post('/api/v1/auth/signup')
            .send({
                name: 'Deactivated User',
                email: 'deactivated@example.com',
                password: 'Password123'
            });
        await User.updateOne({ email: 'deactivated@example.com' }, { isActive: false });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'deactivated@example.com',
                password: 'Password123'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.isActive).toBe(false);
    });
});

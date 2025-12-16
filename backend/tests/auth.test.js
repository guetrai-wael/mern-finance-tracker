const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');

describe('Auth Endpoints', () => {
    it('should register a new user with inactive status', async () => {
        const res = await request(app)
            .post('/api/v1/auth/signup')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });

        expect(res.statusCode).toEqual(201);

        if (res.statusCode !== 201) {
            console.log('[TEST FAIL] Signup status:', res.statusCode);
            console.log('[TEST FAIL] Signup body:', JSON.stringify(res.body));
        }
        expect(res.body.data.email).toEqual('test@example.com');
        // Verify user in DB is inactive
        const user = await User.findOne({ email: 'test@example.com' });
        console.log('[TEST DEBUG] User isActive:', user.isActive);
        expect(user.isActive).toBe(false);
    });

    it('should allow login for inactive user but return inactive status', async () => {
        // Create user
        await User.create({
            name: 'Inactive User',
            email: 'inactive@example.com',
            password: 'hashedpassword', // Would need hashing utility in real test or mock
            isActive: false
        });

        // We need to bypass hashing for this test or use the actual register endpoint first
        // Let's use register endpoint to be safe
        await request(app)
            .post('/api/v1/auth/signup')
            .send({
                name: 'Inactive User 2',
                email: 'inactive2@example.com',
                password: 'password123'
            });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'inactive2@example.com',
                password: 'password123'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.isActive).toBe(false);
        expect(res.body.data).toHaveProperty('expiresAt');
    });
});

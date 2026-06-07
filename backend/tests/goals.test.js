const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const { signAccess } = require('../src/utils/jwt');

describe('Goals Endpoints', () => {
    let cookie;

    beforeEach(async () => {
        const user = await User.create({
            name: 'Goal User',
            email: 'goal@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000)
        });
        const token = signAccess({ sub: user._id, role: 'user' });
        cookie = `accessToken=${token}`;
    });

    it('should create a goal', async () => {
        const res = await request(app)
            .post('/api/v1/goals')
            .set('Cookie', [cookie])
            .send({
                name: 'Emergency Fund',
                targetAmount: 5000,
                category: 'emergency'
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.name).toEqual('Emergency Fund');
        expect(res.body.data.targetAmount).toEqual(5000);
    });

    it('should list goals for the authenticated user', async () => {
        await request(app)
            .post('/api/v1/goals')
            .set('Cookie', [cookie])
            .send({ name: 'Vacation', targetAmount: 2000, category: 'vacation' });

        const res = await request(app)
            .get('/api/v1/goals')
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body.data) || Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should add a contribution to a goal', async () => {
        const createRes = await request(app)
            .post('/api/v1/goals')
            .set('Cookie', [cookie])
            .send({ name: 'Car', targetAmount: 10000, category: 'car' });

        const goalId = createRes.body.data._id || createRes.body.data.id;

        const res = await request(app)
            .post(`/api/v1/goals/${goalId}/contribute`)
            .set('Cookie', [cookie])
            .send({ amount: 250, description: 'First deposit' });

        expect([200, 201]).toContain(res.statusCode);
    });

    it('should reject create with invalid category', async () => {
        const res = await request(app)
            .post('/api/v1/goals')
            .set('Cookie', [cookie])
            .send({ name: 'Bad', targetAmount: 100, category: 'spaceship' });

        expect(res.statusCode).toEqual(400);
    });
});

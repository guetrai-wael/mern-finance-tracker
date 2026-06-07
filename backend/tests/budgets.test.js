const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const { signAccess } = require('../src/utils/jwt');

describe('Budgets Endpoints', () => {
    let cookie;

    beforeEach(async () => {
        const user = await User.create({
            name: 'Budget User',
            email: 'budget@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000)
        });
        const token = signAccess({ sub: user._id, role: 'user' });
        cookie = `accessToken=${token}`;
    });

    it('should upsert a budget for a given month', async () => {
        const res = await request(app)
            .post('/api/v1/budgets')
            .set('Cookie', [cookie])
            .send({ month: '2026-06', totalBudget: 2500 });

        expect([200, 201]).toContain(res.statusCode);
        expect(res.body.data.totalBudget).toEqual(2500);
    });

    it('should fetch the upserted budget by month', async () => {
        await request(app)
            .post('/api/v1/budgets')
            .set('Cookie', [cookie])
            .send({ month: '2026-06', totalBudget: 1800 });

        const res = await request(app)
            .get('/api/v1/budgets?month=2026-06')
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.totalBudget).toEqual(1800);
    });

    it('should reject upsert with malformed month', async () => {
        const res = await request(app)
            .post('/api/v1/budgets')
            .set('Cookie', [cookie])
            .send({ month: 'June 2026', totalBudget: 500 });

        expect(res.statusCode).toEqual(400);
    });
});

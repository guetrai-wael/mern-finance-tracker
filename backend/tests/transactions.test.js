const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const { signAccess } = require('../src/utils/jwt');

describe('Transactions Endpoints', () => {
    let cookie;

    beforeEach(async () => {
        const user = await User.create({
            name: 'Tx User',
            email: 'tx@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000)
        });
        const token = signAccess({ sub: user._id, role: 'user' });
        cookie = `accessToken=${token}`;
    });

    it('should create an expense transaction', async () => {
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({
                amount: 42.50,
                type: 'expense',
                description: 'Coffee'
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.amount).toEqual(42.50);
        expect(res.body.data.type).toEqual('expense');
    });

    it('should list transactions for the authenticated user', async () => {
        await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 100, type: 'income', description: 'Salary' });

        const res = await request(app)
            .get('/api/v1/transactions')
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body.data) || Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should reject create with invalid type', async () => {
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 10, type: 'bogus' });

        expect(res.statusCode).toEqual(400);
    });

    it('should reject unauthenticated requests', async () => {
        const res = await request(app)
            .get('/api/v1/transactions');

        expect(res.statusCode).toEqual(401);
    });
});

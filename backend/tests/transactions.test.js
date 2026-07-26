const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Account = require('../src/models/account.model');
const { signAccess } = require('../src/utils/jwt');

describe('Transactions Endpoints', () => {
    let cookie;
    let user;

    beforeEach(async () => {
        user = await User.create({
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

    it('should assign a default account when none is given', async () => {
        // The stale-client guarantee: a cached SPA that predates accounts must
        // keep working, and the server fills in the account.
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 10, type: 'expense' });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.account).toBeDefined();
    });

    it('should populate the account on list results', async () => {
        await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 10, type: 'expense' });

        const res = await request(app).get('/api/v1/transactions').set('Cookie', [cookie]);

        // The UI renders transaction.account.name, so this must be an object.
        expect(res.body.data[0].account).toBeDefined();
        expect(res.body.data[0].account.name).toEqual('Main Account');
    });

    it('should filter by account', async () => {
        const second = await Account.create({ user: user._id, name: 'Cash' });

        await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 10, type: 'expense', description: 'default acct' });
        await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 20, type: 'expense', account: String(second._id), description: 'cash acct' });

        const res = await request(app)
            .get(`/api/v1/transactions?account=${second._id}`)
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].description).toEqual('cash acct');
    });

    it('should accept type=transfer as a list filter', async () => {
        // validationSchemas rejected this before transfers existed, which would
        // have 400'd the transfer filter the UI is about to grow.
        const res = await request(app)
            .get('/api/v1/transactions?type=transfer')
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
    });

    it('should honour an explicit limit', async () => {
        for (let i = 0; i < 5; i += 1) {
            await request(app)
                .post('/api/v1/transactions')
                .set('Cookie', [cookie])
                .send({ amount: i + 1, type: 'expense' });
        }

        const res = await request(app)
            .get('/api/v1/transactions?limit=2')
            .set('Cookie', [cookie]);

        expect(res.body.data).toHaveLength(2);
    });
});

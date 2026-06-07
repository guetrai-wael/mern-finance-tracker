const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const { signAccess } = require('../src/utils/jwt');

describe('Categories Endpoints', () => {
    let cookie;

    beforeEach(async () => {
        const user = await User.create({
            name: 'Cat User',
            email: 'cat@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000)
        });
        const token = signAccess({ sub: user._id, role: 'user' });
        cookie = `accessToken=${token}`;
    });

    it('should create a category', async () => {
        const res = await request(app)
            .post('/api/v1/categories')
            .set('Cookie', [cookie])
            .send({ name: 'Groceries', description: 'Food and household' });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.name).toEqual('Groceries');
    });

    it('should list categories for the authenticated user', async () => {
        await request(app)
            .post('/api/v1/categories')
            .set('Cookie', [cookie])
            .send({ name: 'Rent' });

        const res = await request(app)
            .get('/api/v1/categories')
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body.data) || Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should reject create with too-short name', async () => {
        const res = await request(app)
            .post('/api/v1/categories')
            .set('Cookie', [cookie])
            .send({ name: 'X' });

        expect(res.statusCode).toEqual(400);
    });
});

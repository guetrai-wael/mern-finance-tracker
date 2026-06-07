describe('Smoke', () => {
    it('app module loads without throwing', () => {
        expect(() => require('../src/app')).not.toThrow();
    });

    it('app exports an Express handler', () => {
        const app = require('../src/app');
        expect(typeof app).toBe('function');
        expect(typeof app.use).toBe('function');
    });
});

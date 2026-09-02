const { prorate } = require('../src/services/pricing');
test('prorates mid-cycle', () => expect(prorate(30, 15, 30)).toBe(15));

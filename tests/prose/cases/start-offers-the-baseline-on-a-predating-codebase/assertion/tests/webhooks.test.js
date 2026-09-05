const { deliver } = require('../src/services/webhooks');
test('gives up after five attempts', () => expect(() => deliver('u', {}, 6)).toThrow());

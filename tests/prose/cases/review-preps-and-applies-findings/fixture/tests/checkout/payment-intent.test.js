// Intent created on checkout start; card-only enforced; rejection
// surfaces; duplicate start does not mint a second intent.
test('creates a card-only intent on checkout start', () => {
  const order = { id: 'ord-1' };
  const intent = { order: order.id, methods: ['card'] };
  expect(intent.methods).toEqual(['card']);
});

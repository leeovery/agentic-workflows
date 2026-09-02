// Create a gateway payment intent when checkout begins. Card-only
// is enforced at creation; gateway rejection surfaces as a checkout
// error and a duplicate start reuses the existing intent.
export function createPaymentIntent(order) {
  return gateway.intents.create({ order: order.id, methods: ['card'] });
}

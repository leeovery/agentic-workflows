// Create a gateway payment intent when checkout begins. Card-only
// is enforced at creation.
export function createPaymentIntent(order) {
  return gateway.intents.create({ order: order.id, methods: ['card'] });
}

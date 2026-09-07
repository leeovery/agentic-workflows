// Create a gateway payment intent when checkout begins. Card-only is
// enforced at creation and gateway rejection surfaces as a checkout
// error.
export function createPaymentIntent(order) {
  return gateway.intents.create({ order: order.id, methods: ['card'] });
}

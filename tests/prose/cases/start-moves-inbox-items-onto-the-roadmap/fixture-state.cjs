'use strict';

// The harvested Orderflow roadmap with nothing pulled, and two captures
// waiting in the inbox beside it — an idea and a bug, each decided but
// not for now. The roadmap's horizons are what the set is placed under.

const m = require('../../mainlines/roadmap.cjs');

const SCHEDULED_PICKUP = [
  '# Scheduled Pickup',
  '',
  'Customers ordering ahead for collection can only ask for "as soon as',
  'possible". Regulars who order lunch at nine for a half-twelve pickup',
  'end up with food that sat on the pass for three hours, or they wait',
  'until noon to order and then queue. The idea: let the customer choose',
  'a pickup time when they place the order, from the slots the',
  'restaurant is open, and have the order reach the kitchen at the right',
  'moment rather than the moment it was placed.',
  '',
  'Restaurants would set how far ahead a slot can be booked and how many',
  'orders a slot takes. Nothing about delivery changes; this is pickup',
  'only.',
  '',
].join('\n');

const DOUBLE_TIP = [
  '# Tip Charged Twice After Basket Edit',
  '',
  'On the pilot storefront, a customer who picks a tip at checkout, goes',
  'back to the basket to change an item, and then returns to checkout is',
  'charged the tip twice. The checkout screen shows one tip line, but the',
  'card charge and the restaurant\'s payout report both carry two. It',
  'happens every time the basket is edited after a tip was chosen, on',
  'phone and desktop alike.',
  '',
  'Two pilot restaurants have already refunded customers by hand for it.',
  'It does not happen when no tip is chosen, or when the tip is chosen',
  'after the last basket edit.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);
    m.map(h);
    h.write('.workflows/.inbox/ideas/2026-01-01--scheduled-pickup.md', SCHEDULED_PICKUP);
    h.write('.workflows/.inbox/bugs/2026-01-01--tip-charged-twice.md', DOUBLE_TIP);
  },
};

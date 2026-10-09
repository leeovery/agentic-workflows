'use strict';

// A roadmap holding two waiting bugs and a waiting idea. The bugs came
// off the inbox — the transaction that put them on moved their notes to
// the roadmap's own notes — and the idea was placed directly. No session
// log and no work unit: the notes are the bugs' whole record.

const m = require('../../mainlines/roadmap.cjs');

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

const RECEIPT_TIP = [
  '# Receipt Total Leaves Out the Tip',
  '',
  'The emailed receipt lists the tip as its own line, but the total at',
  'the bottom is the food total alone — the tip is never added in. The',
  'card statement shows the larger figure, so customers write in asking',
  'why they were charged more than their receipt says. Every receipt',
  'with a tip on it is wrong this way; receipts without a tip are',
  'correct.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);

    h.write('.workflows/.inbox/bugs/2026-01-01--tip-charged-twice.md', DOUBLE_TIP);
    h.write('.workflows/.inbox/bugs/2026-01-01--receipt-omits-the-tip.md', RECEIPT_TIP);
    const entries = '.workflows/.cache/inbox/roadmap-items.json';
    h.write(entries, JSON.stringify([
      {
        name: 'tip-charged-twice',
        horizon: 'next',
        summary: 'a tip is charged twice once the basket is edited after choosing it',
        note: '.workflows/.inbox/bugs/2026-01-01--tip-charged-twice.md',
      },
      {
        name: 'receipt-omits-the-tip',
        horizon: 'next',
        summary: 'the emailed receipt\'s total leaves out the tip',
        note: '.workflows/.inbox/bugs/2026-01-01--receipt-omits-the-tip.md',
      },
    ], null, 2));
    h.engine('roadmap', 'add-batch', '--file', entries);
    h.remove(entries); // scratch — gitignored in a real project, not fixture state

    h.engine('roadmap', 'add', 'loyalty',
      '--horizon', 'later',
      '--summary', 'repeat-customer rewards to drive reorders');
  },
};

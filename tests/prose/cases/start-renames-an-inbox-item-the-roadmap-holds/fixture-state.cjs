'use strict';

// The harvested Orderflow roadmap with nothing pulled, plus a `receipts`
// idea placed directly under `v1`. One capture waits in the inbox: a bug
// whose capture slug is also `receipts` — a different thing that happens
// to share the roadmap item's name.

const m = require('../../mainlines/roadmap.cjs');

const RECEIPT_TIP = [
  '# Receipts',
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
    m.map(h);
    h.engine('roadmap', 'add', 'receipts',
      '--horizon', 'v1',
      '--summary', 'customers download itemised receipts from their order history');
    h.write('.workflows/.inbox/bugs/2026-01-01--receipts.md', RECEIPT_TIP);
  },
};

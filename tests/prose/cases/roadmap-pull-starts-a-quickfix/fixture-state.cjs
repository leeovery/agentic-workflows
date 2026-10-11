'use strict';

// A roadmap holding two waiting quick-fixes and a waiting idea. The
// quick-fixes came off the inbox — the transaction that put them on moved
// their notes to the roadmap's own notes — and the idea was placed
// directly. No session log and no work unit: the notes are the
// quick-fixes' whole record.

const m = require('../../mainlines/roadmap.cjs');

const EMAIL_SUBJECT = [
  '# Order Email Subject Names the Restaurant',
  '',
  'The order confirmation email goes out with the subject "Your order"',
  'for every restaurant on the pilot. Customers who order from two of',
  'our restaurants cannot tell the emails apart in their inbox. The',
  'subject should carry the restaurant\'s name — "Your order from',
  '{restaurant}". The name is already on the order; only the subject',
  'line changes.',
  '',
].join('\n');

const FOOTER_YEAR = [
  '# Storefront Footer Shows Last Year',
  '',
  'The storefront footer\'s copyright line is hard-coded to 2025, so every',
  'pilot storefront reads out of date. It should show the current year,',
  'read when the page is built. Nothing else in the footer changes.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);

    h.write('.workflows/.inbox/quickfixes/2026-01-01--order-email-subject-names-the-restaurant.md', EMAIL_SUBJECT);
    h.write('.workflows/.inbox/quickfixes/2026-01-01--footer-shows-last-year.md', FOOTER_YEAR);
    const entries = '.workflows/.cache/inbox-roadmap.json';
    h.write(entries, JSON.stringify([
      {
        name: 'order-email-subject-names-the-restaurant',
        horizon: 'next',
        summary: 'the order confirmation email\'s subject names the restaurant',
        note: '.workflows/.inbox/quickfixes/2026-01-01--order-email-subject-names-the-restaurant.md',
      },
      {
        name: 'footer-shows-last-year',
        horizon: 'next',
        summary: 'the storefront footer shows the current year, not 2025',
        note: '.workflows/.inbox/quickfixes/2026-01-01--footer-shows-last-year.md',
      },
    ], null, 2));
    h.engine('roadmap', 'add-batch', '--file', entries);
    h.remove(entries); // scratch — gitignored in a real project, not fixture state

    h.engine('roadmap', 'add', 'loyalty',
      '--horizon', 'later',
      '--summary', 'repeat-customer rewards to drive reorders');
  },
};

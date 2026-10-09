'use strict';

// A project with nothing started and two captures in the inbox — an idea
// and a bug, both about the orders list's filters. The set mixes types,
// so its work-type pre-seed comes from the largest kind in it.

const m = require('../../mainlines/feature.cjs');

const SAVED_FILTERS = [
  '# Saved Search Filters',
  '',
  'The orders list is filtered the same way every day — status, date',
  'range, customer — and the combination has to be rebuilt by hand each',
  'time. The idea: let a user pick the filters they use often, name the',
  'combination, and have it appear in a dropdown above the list so it',
  'applies in one click.',
  '',
  'Filters would be per-user, not shared — support staff each have',
  'their own slice of the orders they watch. Nothing else about the',
  'orders list needs to change: same columns, same paging, same export.',
  '',
].join('\n');

const LAST_DAY = [
  '# Date Filter Drops the Last Day',
  '',
  'Filtering the orders list by a date range leaves out every order',
  'placed on the range\'s last day. Picking 1–7 March shows orders from',
  'the 1st to the 6th; the 7th\'s orders only appear when the range is',
  'stretched to the 8th. Support staff reconciling a week of orders',
  'against the payment provider\'s report keep finding a day\'s worth',
  'missing and raising it as lost orders.',
  '',
  'It happens for every range, including a single day, which shows',
  'nothing at all.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);
    h.write('.workflows/.inbox/ideas/2026-01-01--saved-search-filters.md', SAVED_FILTERS);
    h.write('.workflows/.inbox/bugs/2026-01-01--date-filter-drops-the-last-day.md', LAST_DAY);
  },
};

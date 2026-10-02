'use strict';

// A project with nothing started and two captured ideas in the inbox —
// the state the capture skills leave behind. Both ideas circle the same
// feature (filters on the orders list) so the working set shapes into
// one coherent work unit.

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
  'their own slice of the orders they watch, and sharing would turn a',
  'personal shortcut into a team-wide naming argument. Nothing else',
  'about the orders list needs to change: same columns, same paging,',
  'same export. This is purely about not re-entering the same three',
  'filter fields dozens of times a day.',
  '',
].join('\n');

const DEFAULT_VIEW = [
  '# Filter Default View',
  '',
  'Related to saving filters on the orders list: once a user has a',
  'saved combination, one of them is almost always "their" view — the',
  'one they open first every morning. The idea is to let a user mark',
  'one saved filter as their default, so the orders list opens already',
  'filtered to it when they log in.',
  '',
  'Without this, the saved dropdown still helps, but the first act of',
  'every session is picking the same entry from it. A default makes',
  'the common case zero-click. It should be per-user like the filters',
  'themselves, and easy to clear — falling back to the unfiltered list',
  'when no default is set.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);
    h.write('.workflows/.inbox/ideas/2026-01-01--saved-search-filters.md', SAVED_FILTERS);
    h.write('.workflows/.inbox/ideas/2026-01-01--filter-default-view.md', DEFAULT_VIEW);
  },
};

'use strict';

// The harvested Orderflow roadmap with its first slice in delivery:
// `ordering` is pulled into the `launch` epic, so the `mvp` horizon is
// partly being built — `menu-management` and `kitchen-display` still
// wait beside it. An add aimed at `mvp` takes the routed confirm.

const m = require('../../mainlines/roadmap.cjs');

const DRAFT = '.workflows/.cache/launch/discovery/session-001.md';

module.exports = {
  build(h) {
    m.init(h);
    m.map(h);
    h.write(DRAFT, [
      '# Discovery Session 001',
      '',
      'Date: 2026-01-01',
      'Work unit: launch',
      '',
      '## Description (as of session)',
      '',
      'Customers ordering from a restaurant\'s menu on their phones.',
      '',
      '## Seed',
      '',
      '(none)',
      '',
      '## Imports',
      '',
      '(none)',
      '',
      '## Map State at Start',
      '',
      '(empty — first session)',
      '',
      '## Exploration',
      '',
      'Pulled from the roadmap\'s `mvp` horizon: customer ordering, the',
      'first slice of Orderflow to be built. Customers order from a',
      'restaurant\'s menu on their phones; the product is unusable without',
      'it. Menu upkeep and the kitchen display follow once ordering',
      'stands.',
      '',
      '## Edits',
      '',
      '(none)',
      '',
      '## Topics Identified',
      '',
      '(none)',
      '',
      '## Conclusion',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('workunit', 'create', 'launch', 'epic',
      '--description', 'Customers ordering from a restaurant\'s menu on their phones',
      '--session-log-file', DRAFT);
    h.remove(DRAFT); // scratch — gitignored in a real project, not fixture state
    h.engine('roadmap', 'pull', 'ordering', '--into', 'launch');
  },
};

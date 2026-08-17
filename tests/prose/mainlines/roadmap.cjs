'use strict';

// The canonical roadmap mainline — `orderflow`, a restaurant-ordering
// product laid out at product altitude — as staged builders each fixture
// recipe composes a prefix of. Engine calls mirror the sequences the
// roadmap skill's prose prescribes; content files are the artifacts a real
// product session leaves.
//
// Dates are literals matching the frozen recipe clock (2026-01-01).

function init(h) {
  h.knowledge('setup', '--keyword-only');
  h.engine('boot');
}

// One closed product session and a harvested map: three items in `mvp`,
// one in `v1` — all waiting, no work units.
function map(h) {
  const draft = '.workflows/.cache/roadmap/session-draft.md';
  h.write(draft, [
    '# Roadmap Session 001',
    '',
    'Date: 2026-01-01',
    '',
    '## Imports (as of session)',
    '',
    '(none)',
    '',
    '## Map State at Start',
    '',
    '(empty — first session)',
    '',
    '## Exploration',
    '',
    'Laid out Orderflow — a white-label ordering platform for small',
    'restaurants. For launch the product needs customers ordering from a',
    'menu, operators maintaining that menu, and orders reaching the',
    'kitchen; those three form the first slice. Loyalty came up',
    'repeatedly as a retention play, not a launch need — placed after',
    'launch in the user\'s own words. Considered making kitchen printing',
    'a later add-on; rejected — a kitchen that cannot see orders makes',
    'the product unusable on day one.',
    '',
    '## Edits',
    '',
    '(none)',
    '',
    '## Items Sorted',
    '',
    '### ordering',
    '',
    '- Horizon: mvp',
    '- Why: the product is unusable without customers ordering',
    '',
    '### menu-management',
    '',
    '- Horizon: mvp',
    '- Why: operators must maintain what customers order from',
    '',
    '### kitchen-display',
    '',
    '- Horizon: mvp',
    '- Why: orders must reach the kitchen on day one',
    '',
    '### loyalty',
    '',
    '- Horizon: v1',
    '- Why: a retention play, placed after launch by the user',
    '',
    '## Conclusion',
    '',
    '4 item(s) sorted. Roadmap now has 4 items across 2 horizons.',
    '',
  ].join('\n'));
  h.engine('roadmap', 'session', 'open', '--session-log-file', draft);

  const items = '.workflows/.cache/roadmap/proposed-items.json';
  h.write(items, JSON.stringify([
    { name: 'ordering', horizon: 'mvp', summary: 'customers order from a menu', sources: ['.roadmap/sessions/session-001.md'] },
    { name: 'menu-management', horizon: 'mvp', summary: 'operators maintain the menu', sources: ['.roadmap/sessions/session-001.md'] },
    { name: 'kitchen-display', horizon: 'mvp', summary: 'orders reach the kitchen', sources: ['.roadmap/sessions/session-001.md'] },
    { name: 'loyalty', horizon: 'v1', summary: 'repeat-customer rewards to drive reorders', sources: ['.roadmap/sessions/session-001.md'] },
  ], null, 2));
  h.engine('roadmap', 'add-batch', '--file', items);
  h.engine('roadmap', 'session', 'close', '-m', 'roadmap: close session 001');
  h.remove(items); // scratch — gitignored in a real project, not fixture state
}

module.exports = { init, map };

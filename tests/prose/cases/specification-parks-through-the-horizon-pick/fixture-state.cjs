'use strict';

// A feature's specification opened in an earlier sitting and left at
// its first extraction: the discussion is concluded, the specification
// file holds the body template and nothing else, and the item is in
// progress with its one source still `pending`. Construction's next
// move is to extract from the discussion and put the first piece up for
// approval.
//
// The product already has a roadmap: two horizons in release order,
// `v1` then `v2`, each holding one waiting item. That is what makes the
// horizon a pick rather than a question — the park has existing labels
// to choose from.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);

    // The earlier sitting: the file written from the body template
    // before any manifest change, the item registered, review state and
    // gate modes set, the initialisation committed.
    h.write(`.workflows/${WU}/specification/${WU}/specification.md`, m.specification([]));
    h.engine('topic', 'start', WU, 'specification', WU);
    h.engine('manifest', 'set', `${WU}.specification.${WU}`, `sources.${WU}.status`, 'pending');
    h.engine('manifest', 'set', `${WU}.specification.${WU}`,
      'review_cycle=0', 'finding_gate_mode=gated', 'construction_gate_mode=gated', 'date=2026-01-01');
    h.engine('commit', WU, '-m', `spec(${WU}): initialize specification`, '--topic', `specification/${WU}`);

    // The product roadmap, laid out before this feature was picked up.
    h.engine('roadmap', 'add', 'wallet-payments', '--horizon', 'v1',
      '--summary', 'shoppers pay with Apple Pay or Google Pay at checkout');
    h.engine('roadmap', 'add', 'subscription-billing', '--horizon', 'v2',
      '--summary', 'customers are charged on a recurring plan');
  },
};

'use strict';

// A graphed plan at the review boundary, every gate mode `gated` and
// `review_cycle` 0, whose integrity pass stages two findings against it:
// one whose whole substance is the builder's — how the capture consumer
// resolves the order a capture names, a mechanism the specification
// never decided — and one real gap, a criterion the shopper meets that
// the specification decides and the intent task never carries.
//
// The plan's three tasks carry a one-line description each and no
// acceptance criteria, which is what leaves room for the real gap; the
// specification decides both the card-only rule and the user-visible
// error a gateway rejection surfaces as.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.planAuthored(h);
    m.planGraphed(h);
  },
};

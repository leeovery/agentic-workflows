'use strict';

// A graphed plan at the review boundary, every gate mode `gated` and
// `review_cycle` 0, with one perturbation on the mainline: the capture
// task's body carries a **Do** the specification never decided — a
// three-attempt retry at fixed delays, a delivery key, and a 24-hour
// eviction window. The specification decides what a capture does to its
// order and that repeat deliveries change nothing; it decides nothing
// about retries, keys or how long a consumer remembers a delivery.
//
// The frontmatter is planGraphed's own, rewritten unchanged, so the
// grapher's stub reapplies the same edges over the perturbed body.
//
// The traceability stub stages two findings against this world: the
// invented mechanism, whose fix is removal with the decided behaviour
// restated as criteria, and a rule the specification decides that the
// attach task never carries.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.planAuthored(h);
    m.planGraphed(h);

    h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${m.WU}-2-1.md`, [
      '---',
      `id: ${m.WU}-2-1`,
      'phase: 2',
      'status: pending',
      'created: 2026-01-01',
      'depends_on:',
      `  - ${m.WU}-1-2`,
      '---',
      '',
      '# Handle Capture Webhooks',
      '',
      'Consume gateway capture webhooks and mark the order paid; no polling path.',
      "**Do**: Mark the order paid through the shared retry helper — three attempts at 200 ms, 400 ms and 800 ms before giving up — and key the consumer's seen-delivery set on the gateway event id, evicting entries older than 24 hours.",
      '',
    ].join('\n'));
  },
};

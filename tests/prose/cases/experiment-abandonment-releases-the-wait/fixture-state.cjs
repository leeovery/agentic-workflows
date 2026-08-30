'use strict';

// The `pay` feature after a mid-discussion empirical wall and its
// unhappy ending. Webhook timing hit the wall: the point moved to an
// engine-owned evidence wait, E1 (p95 webhook delivery against the
// sandbox) was conceived and designed — and then abandoned before it
// ran: the sandbox export turned out far too sparse to answer a p95.
// The abandonment released the wait and flagged the discussion, whose
// next entry is this walk.

const f = require('../../mainlines/feature.cjs');

const WU = f.WU;

module.exports = {
  build(h) {
    f.init(h);
    f.create(h);

    // The discussion, mid-flight, with the waiting point documented the
    // way the empirical-wall exit leaves it.
    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
      '# Discussion: Pay',
      '',
      '## Context',
      '',
      'Accept card payments at checkout using the existing gateway',
      'account. This discussion settles the capture flow.',
      '',
      '---',
      '',
      '## Retry Policy',
      '',
      '### Context',
      'A failed capture attempt has to retry without double-charging.',
      '',
      '### Decision',
      'Our own retry schedule with idempotency keys on every capture',
      'attempt. Bounded at three attempts before surfacing to the',
      'operator.',
      '',
      '---',
      '',
      '## Webhook Timing',
      '',
      '### Context',
      'How long the checkout waits on the capture webhook before falling',
      'back to polling. The window leans on how fast the gateway really',
      'delivers, which nobody has measured.',
      '',
      '2026-01-01 — Waiting on experiment evidence — whether the',
      'gateway\'s p95 webhook delivery time fits inside a two-second',
      'checkout wait window.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Visibility beats convenience anywhere money moves twice.',
      '',
      '### Open Threads',
      '- Webhook timing — waiting on experiment evidence (E1, p95',
      '  delivery against the sandbox).',
      '',
      '### Current State',
      '- Retry policy resolved.',
      '- Webhook timing blocked pending evidence.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'retry-policy');
    h.engine('discussion-map', 'add', WU, WU, 'webhook-timing');
    h.engine('commit', WU, '-m', `discussion(${WU}): initialize ${WU} discussion`, '--topic', `discussion/${WU}`);
    h.engine('discussion-map', 'set', WU, WU, 'retry-policy', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'webhook-timing', 'exploring');
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): mark webhook-timing waiting on experiment`, '--topic', `discussion/${WU}`);

    // The spawned experiment: conceived with the wait recorded, designed,
    // then put down before it ran.
    h.engine('topic', 'start', WU, 'experiment', WU);
    h.engine('commit', WU, '-m', `experiment(${WU}): initialize ${WU} experiments`, '--topic', `experiment/${WU}`);
    h.engine('experiment', 'create', WU, WU, '--slug', 'p95-webhook-delivery');
    h.engine('experiment', 'await', WU, WU, 'E1');
    h.engine('commit', WU, '-m', `experiment(${WU}/${WU}): E1 conceived — evidence wait recorded`, '--topic', `experiment/${WU}`);
    h.engine('experiment', 'advance', WU, WU, 'E1');
    h.write(`.workflows/${WU}/experiment/${WU}/E1-p95-webhook-delivery/design.md`, [
      '# E1: P95 Webhook Delivery',
      '',
      '## Question',
      '',
      'Does the gateway\'s p95 webhook delivery time fit inside a',
      'two-second checkout wait window? Feeds the webhook-timing decision.',
      '',
      '## Prediction',
      '',
      'We expect yes — the vendor claims sub-second delivery — but the',
      'claim is unmeasured.',
      '',
      '## Decision rule',
      '',
      'If p95 is under two seconds, the checkout waits on the webhook;',
      'otherwise it polls from the start.',
      '',
      '## Setup',
      '',
      'Timestamp deltas over the sandbox webhook export at',
      'logs/webhooks.log, capture-request time to delivery time.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `experiment(${WU}/${WU}): E1 designed — p95-webhook-delivery`, '--topic', `experiment/${WU}`);
    h.engine('experiment', 'abandon', WU, WU, 'E1', '--reason',
      'sandbox export has no request timestamps — a p95 cannot be derived from it');
    h.engine('commit', WU, '-m', `experiment(${WU}/${WU}): E1 abandoned`, '--topic', `experiment/${WU}`);
  },
};

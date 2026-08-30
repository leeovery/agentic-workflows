'use strict';

// The `pay` feature mid-discussion. Retry policy is decided; webhook
// timing is still exploring, and the open question underneath it is
// empirical — whether the gateway's capture webhook actually lands inside
// the checkout's wait window, a number the vendor asserts and nobody has
// measured. The wall the session is about to hit.

const f = require('../../mainlines/feature.cjs');

const WU = f.WU;

module.exports = {
  build(h) {
    f.init(h);
    f.create(h);

    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
      '# Discussion: Pay',
      '',
      '## Context',
      '',
      'Accept card payments at checkout using the existing gateway',
      'account. Card-only for v1 was softly agreed at shaping; this',
      'discussion settles the capture flow.',
      '',
      '---',
      '',
      '## Retry Policy',
      '',
      '### Context',
      'A failed capture attempt has to retry without double-charging.',
      '',
      '### Options Considered',
      '',
      '**Gateway-side retries**',
      '- Pros: no code to own',
      '- Cons: opaque backoff, no visibility',
      '',
      '**Our own retry with idempotency keys**',
      '- Pros: observable, bounded, testable',
      '- Cons: we own the schedule',
      '',
      '### Journey',
      'Gateway-side retries looked free until we asked what the support',
      'story is when a capture stalls — nobody can see inside them. Owning',
      'the schedule with idempotency keys keeps every attempt visible.',
      '',
      '### Decision',
      'Our own retry schedule with idempotency keys on every capture',
      'attempt. Bounded at three attempts before surfacing to the operator.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Visibility beats convenience anywhere money moves twice.',
      '',
      '### Open Threads',
      '- Webhook timing — how long the checkout waits on the capture',
      '  webhook before falling back to polling the payment status.',
      '',
      '### Current State',
      '- Retry policy resolved.',
      '- Webhook timing still open.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'retry-policy');
    h.engine('discussion-map', 'add', WU, WU, 'webhook-timing');
    h.engine('commit', WU, '-m', `discussion(${WU}): initialize ${WU} discussion`, '--topic', `discussion/${WU}`);
    h.engine('discussion-map', 'set', WU, WU, 'retry-policy', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'webhook-timing', 'exploring');
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): retry policy decided`, '--topic', `discussion/${WU}`);
  },
};

'use strict';

// The `pay` feature mid-discussion and waiting on evidence: retry policy
// is decided, and webhook timing was handed to the laboratory as E1 — the
// spawn's lock holds the conclusion until the delivery timing is measured.
// No review has ever run on the topic, so the store is empty. The session
// that resumes here dispatches a review only because the user asks, and
// wraps up while it is still in flight — the pause this case pins.

const f = require('../../mainlines/feature.cjs');

const WU = f.WU;
const SLUG = 'delivery-timing';

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
      'account. Card-only for v1; capture is confirmed by gateway webhook.',
      '',
      '---',
      '',
      '## Retry Policy',
      '',
      '### Context',
      'A failed capture attempt needs a retry stance before the flow ships.',
      '',
      '### Options Considered',
      '',
      '**Retry on a backoff schedule**',
      '- Pros: absorbs transient gateway blips without buyer involvement',
      '- Cons: masks a genuinely declined card for minutes',
      '',
      '**Fail fast, buyer retries**',
      '- Pros: honest state, no hidden queue',
      '- Cons: transient blips surface as failures',
      '',
      '### Journey',
      'Transient gateway errors and genuine declines need different',
      'treatment, and the gateway distinguishes them in the error class.',
      'Retrying only the transient class keeps both properties.',
      '',
      '### Decision',
      'Retry transient-class failures on a short backoff (three attempts);',
      'surface decline-class failures to the buyer immediately.',
      '',
      '---',
      '',
      '## Webhook Timing',
      '',
      '### Context',
      'How long the checkout waits on the capture webhook before showing',
      'the buyer a pending state. The vendor claims sub-second delivery',
      'and the wait-window design leans on that claim.',
      '',
      'Handed to the laboratory 2026-01-01 — awaiting E1; the window',
      'choice waits on measured sandbox delivery timing.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Transient and decline failures split cleanly on the gateway',
      '   error class.',
      '',
      '### Open Threads',
      '- Webhook timing: awaiting E1 — the window rests on measured',
      '  delivery timing.',
      '',
      '### Current State',
      '- Retry policy decided; webhook timing awaiting evidence.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'retry-policy');
    h.engine('discussion-map', 'set', WU, WU, 'retry-policy', 'decided');
    h.engine('discussion-map', 'add', WU, WU, 'webhook-timing');
    h.engine('discussion-map', 'set', WU, WU, 'webhook-timing', 'exploring');
    h.engine('commit', WU, '--topic', `discussion/${WU}`, '-m',
      `discussion(${WU}/${WU}): retry policy decided; webhook timing handed to the laboratory`);

    h.write(`.workflows/.cache/${WU}/discussion/${WU}/problem.md`, [
      '# E1: Delivery Timing',
      '',
      'We need to learn how long capture webhooks actually take to arrive',
      'from the gateway sandbox. The checkout wait window turns on it:',
      'the design leans on the vendor\'s sub-second claim, and nobody has',
      'measured it. We hope the claim holds — a short window is the',
      'simplest buyer experience.',
      '',
      'Spawned from the "pay" discussion, at the wait-window choice, on',
      '2026-01-01.',
      '',
    ].join('\n'));
    h.engine('experiment', 'create', WU, WU, '--slug', SLUG, '--from', 'discussion',
      '--problem', `.workflows/.cache/${WU}/discussion/${WU}/problem.md`);
    h.engine('commit', WU, '--topic', `discussion/${WU}`, '-m',
      `discussion(${WU}/${WU}): spawn E1 ${SLUG}`);
    h.engine('commit', WU, '--topic', `experiment/${WU}`, '--sweep', '-m',
      `experiment(${WU}/${WU}): E1 problem statement`);
  },
};

'use strict';

// The `pay` feature paused on evidence that will never arrive: the
// discussion spawned E1 to measure webhook delivery timing, the design
// froze, measurement began — and the vendor rebuilt the sandbox mid-run,
// so the record was abandoned with that reason. The abandonment released
// the discussion's wait and flagged the item; nothing has re-entered the
// discussion since, so the flag stands and webhook timing is still open.

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
      '## Triage',
      '',
      '(none)',
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
    const created = JSON.parse(h.engine('experiment', 'create', WU, WU, '--slug', SLUG, '--from', 'discussion',
      '--problem', `.workflows/.cache/${WU}/discussion/${WU}/problem.md`));
    h.engine('commit', WU, '--topic', `discussion/${WU}`, '-m',
      `discussion(${WU}/${WU}): spawn E1 ${SLUG}`);
    h.engine('commit', WU, '--topic', `experiment/${WU}`, '--sweep', '-m',
      `experiment(${WU}/${WU}): E1 problem statement`);

    h.engine('experiment', 'advance', WU, WU, 'E1');
    h.write(`${created.dir}/design.md`, [
      '# E1: Delivery Timing',
      '',
      '## Question',
      '',
      'What is the p95 capture-webhook delivery latency from the gateway',
      'sandbox? Feeds the checkout wait-window choice.',
      '',
      '## Prediction',
      '',
      'The vendor claims sub-second delivery; we expect p95 under two',
      'seconds.',
      '',
      '## Decision rule',
      '',
      'If p95 < 2s across the sample, the checkout waits 3s before the',
      'pending state; if p95 >= 2s, the flow goes pending-first.',
      '',
      '## Setup',
      '',
      'Fire 50 sandbox captures with the existing checkout harness and',
      'log request-to-webhook latency per event. Instruments: the gateway',
      'sandbox CLI and a timestamp diff script kept with this record.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `experiment/${WU}`, '-m',
      `experiment(${WU}/${WU}): E1 designed`);
    h.engine('experiment', 'approve', WU, WU, 'E1');
    h.engine('commit', WU, '--topic', `experiment/${WU}`, '-m',
      `experiment(${WU}/${WU}): E1 approved — design frozen`);
    h.engine('experiment', 'advance', WU, WU, 'E1');
    h.write(`${created.dir}/report.md`, [
      '# E1: Delivery Timing — Report',
      '',
      '## Results',
      '',
      'Eleven of fifty captures fired before the run was interrupted; no',
      'aggregate is computed from a partial sample.',
      '',
      '## Deviations',
      '',
      '2026-01-01: the vendor rebuilt the sandbox mid-run — deliveries',
      'after the rebuild arrive on a different infrastructure than the',
      'one production uses, so the sample stopped meaning anything.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `experiment/${WU}`, '-m',
      `experiment(${WU}/${WU}): E1 — run interrupted by the sandbox rebuild`);
    h.engine('experiment', 'abandon', WU, WU, 'E1', '--reason',
      'the vendor rebuilt the sandbox mid-run — it no longer mirrors production delivery timing');
    h.engine('commit', WU, '--topic', `experiment/${WU}`, '-m',
      `experiment(${WU}/${WU}): E1 abandoned`);
  },
};

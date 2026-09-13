'use strict';

// A discussion fully decided and three review cycles deep, every one
// drained clean, the latest snapshot equal to the current map so the
// automatic trigger is quiet. The session that resumes here dispatches
// a fourth review only because the user asks — and then wraps up while
// it is still in flight, which is the close this case pins: the
// review-running gate, the wait it takes, and the landed pass heard
// before the conclusion. The stub holds the report back until the
// session is waiting on it, so the row is in flight when the close
// classifies.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

const REVIEW_REPORT = [
  '# Discussion Review',
  '',
  '## Summary',
  '',
  'Read fresh, the discussion holds a clear context and decided',
  'subtopics carrying their rationale. Coverage is thorough for the',
  'document\'s own scope.',
  '',
  '## Gaps Identified',
  '',
  'None identified.',
  '',
  '## Open Questions',
  '',
  'None identified.',
  '',
  'STATUS: clean',
  'GAPS_COUNT: 0',
  'QUESTIONS_COUNT: 0',
  'SUMMARY: Coverage is thorough; no gaps or open questions.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
      `# Discussion: Pay`,
      '',
      '## Context',
      '',
      'Accept card payments at checkout using the existing gateway',
      'account. Card-only for v1 — wallet support was deferred when the',
      'work was shaped.',
      '',
      '---',
      '',
      '## Capture Confirmation',
      '',
      '### Context',
      'How the checkout learns that a card payment was actually captured.',
      '',
      '### Options Considered',
      '',
      '**Poll the gateway**',
      '- Pros: simple, no inbound endpoint needed',
      '- Cons: slow to confirm, hammers the gateway under load',
      '',
      '**Gateway webhooks**',
      '- Pros: guaranteed delivery, near-immediate confirmation',
      '- Cons: needs a verified inbound endpoint',
      '',
      '### Journey',
      'Polling looked simplest until rate limits came up — confirming a',
      'burst of checkouts by polling would either lag or hammer the',
      'gateway. The webhook is guaranteed by the provider, which settled',
      'it.',
      '',
      '### Decision',
      'Capture is confirmed by the gateway webhooks; the checkout never',
      'polls.',
      '',
      '---',
      '',
      '## Card Data Handling',
      '',
      '### Context',
      'Whether card details ever touch our own servers.',
      '',
      '### Journey',
      'PCI scope drove this: the gateway\'s hosted fields keep the pan',
      'and cvc on the gateway\'s side entirely, so our servers only ever',
      'see a token.',
      '',
      '### Decision',
      'The gateway\'s hosted fields — card details never touch our',
      'servers.',
      '',
      '---',
      '',
      '## Failed Payment Retries',
      '',
      '### Context',
      'What happens after a card payment fails — how many attempts, at',
      'what spacing, and when the counter resets.',
      '',
      '### Options Considered',
      '',
      '**Single attempt**',
      '- Pros: never hammers a declining card',
      '- Cons: punishes transient gateway blips',
      '',
      '**Bounded retries with backoff**',
      '- Pros: covers the transient case; bounded exposure',
      '- Cons: the bound and the backoff need pinning',
      '',
      '### Journey',
      'Unbounded retries risk hammering a declining card; a single',
      'attempt punishes transient gateway blips. Three attempts with',
      'exponential backoff covers the transient case without re-running',
      'a hard decline all day.',
      '',
      '### Decision',
      'Three attempts per payment, exponential backoff, counter resets',
      'only on a new checkout.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Card data decided — hosted fields, nothing touches our servers.',
      '- Failed-payment retries decided — three attempts, exponential backoff.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));

    // Three completed review cycles, each dispatch through the real
    // arming gate: the first is free, the second arms on one move
    // (capture decided), the third on two (card and retries decided).
    // Every row carries its dispatch-time map snapshot; the latest
    // equals the fully decided map the walk resumes over.
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'card-data-handling');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');

    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, REVIEW_REPORT);
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--clean');

    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-002.md`, REVIEW_REPORT);
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-002', '--clean');

    h.engine('discussion-map', 'set', WU, WU, 'card-data-handling', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'failed-payment-retries', 'decided');
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-003.md`, REVIEW_REPORT);
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-003', '--clean');

    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): document capture, card handling, retries`);
  },
};

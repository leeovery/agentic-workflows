'use strict';

// A discussion mid-flight, resumed mid-walkthrough: a background review
// returned two findings, the first was raised in a prior session, and
// the session ended before the second. The store row is acknowledged
// and announced with F1 surfaced and F2 remaining — the walk resumes
// against exactly that shape.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

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
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Failed-payment retries and card-data handling still open.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');
    h.engine('discussion-map', 'add', WU, WU, 'card-data-handling');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): capture confirmation decided`);

    // The agent store, driven through its real lifecycle — order matters:
    // dispatch allocates review-001 in-flight, the report lands on disk,
    // scan promotes it to pending, ack records the findings, announce
    // marks the user told, and surfacing F1 leaves F2 remaining.
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, [
      '# Discussion Review',
      '',
      '## Summary',
      '',
      'The decided ground is well documented, but the decision it rests',
      'on carries an unexamined failure path, and an asserted bound is',
      'never pinned.',
      '',
      '## Gaps Identified',
      '',
      '### F1: Retry cap asserted but never pinned',
      '',
      'The Summary holds failed-payment retries as open while the',
      'conversation leans on "a small bounded number of attempts" — but',
      'no bound, backoff, or reset condition is recorded anywhere. If',
      'the discussion closes without pinning the number, planning will',
      'have to invent one.',
      '',
      '### F2: Webhook capture has no missed-webhook path',
      '',
      'The Capture Confirmation decision rests on the gateway webhook',
      'being guaranteed, and polling is explicitly ruled out. Nothing',
      'records what happens when the webhook never arrives — a gateway',
      'outage or a rejected delivery leaves the order pending forever,',
      'and with polling off the table there is no documented',
      'reconciliation path.',
      '',
      'STATUS: gaps_found',
      'FINDINGS: F1,F2',
      'GAPS_COUNT: 2',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: Two gaps — an unpinned retry bound, and no path for a webhook that never arrives.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--findings', 'F1,F2');
    h.engine('agent', 'announce', WU, 'discussion', WU, 'review-001');
    h.engine('agent', 'surface', WU, 'discussion', WU, 'review-001', 'F1');
  },
};

'use strict';

// A discussion mid-flight whose background review came back entirely in
// the apply lane: three findings, every one a correction the document's
// own decisions already determine. The store row is acknowledged and
// announced, nothing surfaced — the walk opens on the batch screen.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
      '# Discussion: Pay',
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
      'Everything here runs against the legacy gateway account.',
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
      'Polling looked simplest until rate limits came up. The webhook is',
      'guaranteed by the provider, which settled it. An earlier draft',
      'argued for a polling fallback on top of the webhook; that was',
      'dropped once delivery guarantees were confirmed.',
      '',
      '### Decision',
      'Capture is confirmed by the gateway webhooks; the checkout never',
      'polls. A polling fallback remains available if delivery proves',
      'unreliable.',
      '',
      '---',
      '',
      '## Currency Handling',
      '',
      '### Context',
      'What currencies a checkout may quote and capture in.',
      '',
      '### Decision',
      'Amounts are minor units, integer only, never floats. The gateway',
      'is called with the store currency.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Currency handling decided — integer minor units.',
      '- Failed-payment retries still open.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'currency-handling');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'currency-handling', 'decided');
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): capture and currency decided`);

    // The store driven through its real lifecycle: dispatch allocates the
    // row in-flight, the report lands on disk, scan promotes it to pending,
    // ack records the findings. Announced, nothing surfaced.
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, [
      '# Discussion Review — review-001',
      '',
      '## Summary',
      '',
      'The decided ground is sound. What remains is three places where the',
      'document contradicts a decision it has already taken.',
      '',
      '## Gaps Identified',
      '',
      '### F1: The Decision keeps a polling fallback the Journey retired',
      '',
      '**Lane:** apply',
      '',
      'Capture Confirmation § Journey records that the polling fallback was',
      'dropped once delivery guarantees were confirmed. The Decision beneath',
      'it still ends "A polling fallback remains available if delivery',
      'proves unreliable." The Journey is the argued side; the Decision',
      'sentence is the leftover. Strike it.',
      '',
      '### F2: The capture Context names a gateway the account section retired',
      '',
      '**Lane:** apply',
      '',
      'Capture Confirmation § Context still calls the provider "the legacy',
      'gateway account". The opening Context settled on the existing gateway',
      'account under its current name when card-only was scoped. Rename it',
      'to match.',
      '',
      '### F3: The currency rule is stated for amounts but left implied for refunds',
      '',
      '**Lane:** apply',
      '',
      'Currency Handling decides integer minor units, never floats, and',
      'names the store currency. Refunds are an amount by the same rule and',
      'the section never says so — the rule as decided already covers them.',
      '',
      '## Observations',
      '',
      '- The Options blocks would read faster as a table. Style only.',
      '- No retry ceiling is named yet, but the subtopic is open and the',
      '  Summary says so — not a gap in what is decided.',
      '',
      'STATUS: gaps_found',
      'FINDINGS: F1,F2,F3',
      'GAPS_COUNT: 3',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: Three corrections, all determined by decisions the document already carries.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--findings', 'F1,F2,F3');
    h.engine('agent', 'announce', WU, 'discussion', WU, 'review-001');
  },
};

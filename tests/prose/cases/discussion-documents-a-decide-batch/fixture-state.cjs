'use strict';

// A discussion mid-flight whose background review came back entirely in
// the decide lane: two findings, each a call the record already
// determines — one defensible answer apiece, derivation cited — that the
// document simply hasn't made. Neither is owned by any subtopic on the
// map. The store row is acknowledged and announced, nothing surfaced —
// the drain opens on the decide screen.

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
      'guaranteed by the provider — every event carries a signed payload',
      'and a provider event id — which settled it.',
      '',
      '### Decision',
      'Capture is confirmed by the gateway webhooks; the checkout never',
      'polls.',
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
      'is called with the store currency, and each capture records the',
      'currency it was taken in.',
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
      'The decided ground is sound. Two calls the document never makes are',
      'already determined by it — each has exactly one defensible answer.',
      '',
      '## Gaps Identified',
      '',
      '### F1: Webhook payloads are verified with the gateway signing secret',
      '',
      '**Lane:** decide',
      '',
      'The call: the webhook endpoint verifies every payload against the',
      "gateway's signing secret before acting on it. Determined by the",
      'Capture Confirmation decision — webhooks are the sole confirmation',
      'channel, so an unverified endpoint would accept a forged capture —',
      'and by gateway convention: the Journey already records that every',
      'event arrives signed. No other answer is defensible. No subtopic',
      'on the Discussion Map owns endpoint verification — Capture',
      'Confirmation decided the channel, not its hardening.',
      '',
      '### F2: A refund is issued in the currency of its original capture',
      '',
      '**Lane:** decide',
      '',
      'The call: refunds are issued in the currency the capture was taken',
      'in, never re-quoted. Determined by the Currency Handling decision —',
      'each capture records the currency it was taken in, and integer',
      'minor units carry no conversion path — and by gateway convention:',
      'a refund is made against its capture. No other answer is',
      'defensible. No subtopic on the Discussion Map owns refunds —',
      'Currency Handling decided quoting and capture, and refund flow',
      'never came up.',
      '',
      '## Observations',
      '',
      '- The Options blocks would read faster as a table. Style only.',
      '- No retry ceiling is named yet, but the subtopic is open and the',
      '  Summary says so — not a gap in what is decided.',
      '',
      'STATUS: gaps_found',
      'FINDINGS: F1,F2',
      'GAPS_COUNT: 2',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: Two settled calls the document has not made, each carrying its derivation.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--findings', 'F1,F2');
    h.engine('agent', 'announce', WU, 'discussion', WU, 'review-001');
  },
};

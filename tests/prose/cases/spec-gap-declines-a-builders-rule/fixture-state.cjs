'use strict';

// A specification at the review boundary whose gap analysis stages
// three findings: a settled call the specification's own rules
// determine (the wait before a payment is unconfirmed, which the
// delivery schedule and the exhaustion rule fix between them), a staged
// settled whose whole substance is the order two fields are written in
// inside an internal log line — the builder's, derived by analogy to a
// neighbouring rule, and owed a decline at dispose — and a choice the
// record leaves genuinely open. The audit-log rule and the
// unmatched-delivery rule both sit in the document so the analogy the
// reviewer reaches for is really there; refunds are decided as a window
// and an intent and never as a size, so the open choice has nowhere to
// be settled from.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The completed discussion — the gateway and its re-delivery
    // schedule decided, refunds decided as a window and an intent, the
    // size of a refund never raised.
    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
      '# Discussion: Pay',
      '',
      '## Context',
      '',
      'Accept card payments at checkout using the existing gateway account.',
      '',
      '---',
      '',
      '## Gateway Integration',
      '',
      '### Context',
      'Which account the checkout uses, and how a capture is confirmed.',
      '',
      '### Journey',
      'The existing account carries the rates we already have, so a new',
      'provider was never seriously on the table. Confirmation was the',
      'real question: polling the gateway would let the checkout answer',
      'the customer on the spot, but it answers with a guess whenever the',
      'gateway is slow. We settled on webhooks — the gateway tells us,',
      'and it tells us again if the first attempt fails. Its own',
      're-delivery schedule is three further attempts, at 1, 5 and 25',
      'minutes, and we take that as it stands rather than configuring one',
      'of our own.',
      '',
      '### Decision',
      'Use the existing gateway account — no new provider onboarding.',
      'Capture is confirmed by gateway webhook; the checkout never polls.',
      "The gateway's own re-delivery schedule stands: three further",
      'attempts, at 1, 5 and 25 minutes after the first.',
      '',
      '---',
      '',
      '## Refunds',
      '',
      '### Context',
      'What the support team can undo after a capture, and for how long.',
      '',
      '### Decision',
      'Refunds run against the original payment intent, for 30 days from',
      'capture.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Confirmation is asynchronous by design: the checkout hands the',
      '   customer to the gateway and hears back afterwards, and nothing',
      '   in the flow waits on a poll.',
      '',
      '### Open Threads',
      '- (none)',
      '',
      '### Current State',
      '- Gateway integration and refunds are both resolved.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);

    // Construction done in an earlier sitting: the spec carries the
    // gateway decision with its delivery schedule, the two log rules,
    // and the refunds window. Review has not begun.
    h.engine('topic', 'start', WU, 'specification', WU);
    h.engine('manifest', 'set', `${WU}.specification.${WU}`,
      `sources.${WU}.status=pending`,
      'review_cycle=0',
      'finding_gate_mode=gated',
      'construction_gate_mode=gated',
      'date=2026-01-01');
    h.write(`.workflows/${WU}/specification/${WU}/specification.md`, [
      '# Specification: Pay',
      '',
      '## Specification',
      '',
      '### Payment Intent',
      '',
      '- Checkout creates a payment intent against the existing gateway',
      '  account; card payments only.',
      '- A gateway rejection at creation surfaces as a user-visible',
      '  checkout error.',
      '',
      '### Capture Webhooks',
      '',
      '- Capture is confirmed by gateway webhook, never by polling.',
      '- The gateway re-delivers a failed capture webhook three times — 1,',
      '  5 and 25 minutes after the first attempt.',
      "- A payment is treated as unconfirmed once the gateway's",
      '  re-deliveries are exhausted.',
      '- Duplicate deliveries are idempotent.',
      '- A delivery naming an intent no order carries is logged — the',
      '  intent id, then the delivery time — and ignored.',
      '',
      '### Refunds',
      '',
      '- Refunds are issued against the original payment intent, within 30',
      '  days of capture.',
      '- Every capture and every refund appends a line to the payments',
      '  audit log, carrying the payment intent id and the amount.',
      '',
      '---',
      '',
      '## Working Notes',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', `${WU}.specification.${WU}`, `sources.${WU}.status`, 'incorporated');
    h.engine('commit', WU, '-m', `spec(${WU}): construct`);
  },
};

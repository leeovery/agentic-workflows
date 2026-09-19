'use strict';

// A specification at the review boundary whose gap analysis stages
// three settled calls: two the specification's own rules determine
// between them — how long an order waits before its payment is
// unconfirmed, and whether a refund can run before capture is — and
// one over what the customer gets when that wait runs out, staged on
// an analogy to the rejection rule, which is consistency and not
// determination, so the call is the session's to make and name. The
// gate stays on throughout, so the three land from one screen the user
// reads, expands, and approves. The discussion decides the gateway and
// refunds and is silent on an unconfirmed order, so the session's call
// has a document to own it and a new subtopic to be written into.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The completed discussion — the gateway and its re-delivery
    // schedule decided, refunds decided, an order the gateway never
    // confirms never raised.
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
    // gateway decision with its delivery schedule and the refunds
    // window. Review has not begun.
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

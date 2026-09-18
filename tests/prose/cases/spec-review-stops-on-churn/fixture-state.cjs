'use strict';

// A specification at the review boundary whose gap analysis has
// something to find in two successive cycles, each time somewhere the
// last cycle never touched: cycle 1 in Gateway Integration and Checkout
// Session, cycle 2 in Refunds. Every finding is a call the document's
// own record determines, so all four ride auto once the user opts in —
// which is the shape the churn exit has to stop: nothing recurs,
// everything resolves, and the next cycle brings a fresh pair. The
// document carries the numbers those determinations rest on — the
// delivery schedule, the session's expiry, and the two refund deadlines
// sitting in one section.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The completed discussion — the gateway, the checkout session, and
    // refunds all decided, with the gateway's own six-month refund
    // allowance recorded as background rather than as the limit.
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
      'Polling the gateway would let the checkout answer the customer on',
      'the spot, but it answers with a guess whenever the gateway is slow.',
      'We settled on webhooks — the gateway tells us, and it tells us',
      'again if the first attempt fails. Its own re-delivery schedule is',
      'three further attempts, at 1, 5 and 25 minutes, and we take that as',
      'it stands rather than configuring one of our own.',
      '',
      '### Decision',
      'Use the existing gateway account — no new provider onboarding.',
      'Capture is confirmed by gateway webhook; the checkout never polls.',
      "The gateway's own re-delivery schedule stands: three further",
      'attempts, at 1, 5 and 25 minutes after the first.',
      '',
      '---',
      '',
      '## Checkout Session',
      '',
      '### Context',
      'What the customer is charged, and how long a checkout stays open.',
      '',
      '### Journey',
      'Shipping rates and tax are live lookups, so a total computed at the',
      'cart can differ from one computed at the payment step. We settled',
      'on quoting once, when the payment step opens, and charging exactly',
      'that — a customer must never be charged a number they did not see.',
      'A checkout cannot stay open indefinitely on a quote either; half an',
      'hour is long enough to find a card and short enough that rates have',
      'not moved under it.',
      '',
      '### Decision',
      'The payment step quotes the total when it opens — items, shipping,',
      'tax — and captures exactly that amount. A checkout session expires',
      '30 minutes after it opens, and an expired session returns the',
      'customer to their cart.',
      '',
      '---',
      '',
      '## Refunds',
      '',
      '### Context',
      'What the support team can undo after a capture, and for how long.',
      '',
      '### Journey',
      'The gateway will take a refund against an intent for 180 days, so',
      'nothing technical forces a window on us. Support wanted a clean',
      'cutoff they could say out loud, and a month is what they say to',
      'customers today.',
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
      '1. The customer is charged the figure they confirmed, and the',
      '   checkout never guesses at what the gateway has not told it.',
      '',
      '### Open Threads',
      '- (none)',
      '',
      '### Current State',
      '- Gateway integration, the checkout session, and refunds are all',
      '  resolved.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);

    // Construction done in an earlier sitting. Review has not begun.
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
      '### Gateway Integration',
      '',
      '- Checkout creates payment intents against the existing gateway',
      '  account; card payments only.',
      '- Capture is confirmed by gateway webhook, never by polling.',
      '- The gateway re-delivers a failed capture webhook three times — 1,',
      '  5 and 25 minutes after the first attempt.',
      "- A payment is treated as unconfirmed once the gateway's",
      '  re-deliveries are exhausted.',
      '',
      '### Checkout Session',
      '',
      '- The payment step quotes the total when it opens — items,',
      '  shipping, tax — and captures exactly that amount.',
      '- A checkout session expires 30 minutes after it opens; an expired',
      '  session returns the customer to their cart.',
      '',
      '### Refunds',
      '',
      '- Refunds are issued against the original payment intent, within 30',
      '  days of capture.',
      '- The gateway accepts a refund against an intent for 180 days after',
      '  capture.',
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

'use strict';

// A specification at the review boundary whose input review stages three
// findings: a settled call the discussion determines (where the user
// opts into auto), a choice that is a preference — the order of amount
// and card in the refund confirmation, a fork both sides of which carry
// the same two facts, with nothing in the discussion, the specification,
// or the tree leaning either way — and a choice the sources leave
// genuinely open. The session must decline the middle one at dispose
// and render nothing for it, apply the first under auto with no stop,
// and let the third stand and stop. The non-recommended option is the
// one the user picks there, so the end state distinguishes their choice
// from any rubber-stamp of the recommendation.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The completed discussion — the refund window decided; the quoted
    // total decided with its one re-quote tied to the hand edit; refunds
    // against the original intent, with nothing on what the customer is
    // told when one lands; the failed-webhook retry ceiling never raised.
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
      'Which account and confirmation path the checkout uses.',
      '',
      '### Decision',
      'Use the existing gateway account — no new provider onboarding.',
      'Capture is confirmed by gateway webhooks; the checkout never polls.',
      '',
      '---',
      '',
      '## Quoted Total',
      '',
      '### Context',
      'What total the customer is charged, and when it can change under',
      'them.',
      '',
      '### Journey',
      'Shipping rates and tax are live lookups, so a total computed at the',
      'cart can differ from one computed at the payment step. We settled',
      'on quoting once, when the payment step opens, and charging exactly',
      'that — a customer must never be charged a number they did not see.',
      'The one thing that legitimately changes the total is the customer',
      'changing the order: the moment the customer edits the cart by hand',
      'from the payment step, the total re-quotes and is shown again',
      'before capture.',
      '',
      '### Decision',
      'The payment step quotes the total when it opens — items, shipping,',
      'tax — and captures exactly that amount. The moment the customer',
      'edits the cart by hand from the payment step, the total re-quotes',
      'and the new figure is shown before capture.',
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
      '1. The customer is charged the figure they confirmed, and only their',
      '   own edit to the order can move it.',
      '',
      '### Open Threads',
      '- (none)',
      '',
      '### Current State',
      '- Gateway integration, the quoted total, and refunds are all',
      '  resolved.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);

    // Construction done in an earlier sitting: the spec carries the
    // gateway decision, the quoted total's first-open and hand-edit
    // rules, and opens a Refunds section without the window. Review has
    // not begun.
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
      '',
      '### Quoted Total',
      '',
      '- The payment step quotes the total — items, shipping, tax — when',
      '  it opens, and capture is for exactly that amount.',
      '- An edit to the cart made from the payment step re-quotes the',
      '  total, shown again before capture.',
      '',
      '### Refunds',
      '',
      '- Refunds are issued against the original payment intent.',
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

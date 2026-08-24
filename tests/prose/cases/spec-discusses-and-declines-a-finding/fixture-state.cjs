'use strict';

// A specification at the review boundary whose input review returns two
// settled findings. The user stays gated throughout: the first — the
// 30-day refund window the discussion decides — they approve at the gate;
// the second — a spec-native rounding rule with no Current, whose short
// wording must render as an additions-only diff visible at the gate —
// they talk through via Discuss and decline with a reason. The end state
// distinguishes a declined finding from an applied or skipped one: the
// wording lands nowhere, and the tracking row reads Declined.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The completed discussion — refund window and partial refunds both
    // decided; the failed-webhook retry ceiling never raised.
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
      '## Refunds',
      '',
      '### Context',
      'What the support team can undo after a capture, and for how long.',
      '',
      '### Decision',
      'Refunds run against the original payment intent, for 30 days from',
      'capture. Partial refunds are supported, down to a single line item —',
      'support should never have to refund an entire order to correct one',
      'line.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Per-line-item refunds keep support corrections proportionate to',
      '   the mistake.',
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
    // gateway decision and opens a Refunds section, but states neither
    // the window nor partial support. Review has not begun.
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

'use strict';

// A specification at the review boundary carrying a decision its source
// never made: the webhook verification mechanism — HMAC-SHA256 against
// the raw body with a custom five-minute tolerance window — stated as
// spec content while the discussion decides only that capture is
// webhook-confirmed. Input review must flag it as an Unsourced
// decision; the orchestrator routes it, the exchange settles the
// mechanism with the user, the settlement lands in the discussion as a
// new subtopic section (no prior block — no timeline entry), and the
// spec's own copy re-aligns to what was actually decided.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The completed discussion — webhook-confirmed capture decided,
    // verification mechanism never discussed.
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
      '## Telemetry Coverage',
      '',
      '### Context',
      'Where payment telemetry lands in the checkout flow.',
      '',
      '### Decision',
      'Every checkout module emits payment telemetry at its boundary —',
      'the rule is per-module, whatever the module count.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Per-module telemetry localises checkout failures without a',
      '   funnel rebuild.',
      '',
      '### Open Threads',
      '- (none)',
      '',
      '### Current State',
      '- Gateway integration and telemetry coverage are both resolved.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);

    // Construction done in an earlier sitting: the spec carries the
    // discussion faithfully — plus a verification mechanism nobody
    // decided. Review has not begun.
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
      '### Telemetry Coverage',
      '',
      '- Every checkout module emits payment telemetry at its boundary.',
      '',
      '### Webhook Verification',
      '',
      '- Webhook signatures are verified as HMAC-SHA256 against the raw',
      '  body, with a custom five-minute tolerance window for delayed',
      '  deliveries.',
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

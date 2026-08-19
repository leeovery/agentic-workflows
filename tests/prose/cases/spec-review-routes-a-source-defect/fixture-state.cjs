'use strict';

// A specification mid-flow at the review boundary, faithfully carrying
// a source discussion's false count. The checkout flow claim — four
// modules, with its recorded command — sits in both documents; the
// world has five. Nothing decisive leans on the exact count (the
// telemetry decision covers every module, whatever the number), so
// this is the value-only lane: the claims pass reports a Source
// defect, the orchestrator routes it, the correction lands in the
// discussion in place (no decision revised, no timeline entry), the
// document reindexes, and the spec's own copy re-aligns — the
// discussion never leaves completed.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The checkout flow the discussion counted: five modules, not four.
    const mod = (name, fn) => h.write(`src/checkout/${name}.js`, [
      "'use strict';",
      '',
      `module.exports = function ${fn}(order) {`,
      '  return order;',
      '};',
      '',
    ].join('\n'));
    mod('cart', 'cart');
    mod('address', 'address');
    mod('payment', 'payment');
    mod('confirm', 'confirm');
    mod('wallet-stub', 'walletStub');

    // The completed discussion — the false measured count in Telemetry
    // Coverage's Journey; the decision survives any count.
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
      '### Journey',
      'We counted the flow before deciding placement: the checkout spans',
      'four modules (`ls src/checkout/*.js | wc -l` → 4). Per-module',
      'boundaries beat a single funnel event — failures localise to the',
      'module that dropped the order.',
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
    // discussion's claim faithfully, the source row is incorporated,
    // review has not begun.
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
      '- The checkout flow spans four modules',
      '  (`ls src/checkout/*.js | wc -l` → 4); every checkout module',
      '  emits payment telemetry at its boundary.',
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

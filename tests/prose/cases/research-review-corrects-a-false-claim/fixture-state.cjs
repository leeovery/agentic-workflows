'use strict';

// An in-progress research file, largely concluded in an earlier
// sitting, carrying a false measured claim: the telemetry-placement
// thread counted the checkout flow at four modules with its recorded
// command, and the world holds five. The conclusion leaning on the
// thread is per-module and survives any count, so the resumed
// session's document review must catch it on the unverified-claims
// sweep, correct the value in place with the command re-recorded, and
// conclude without ceremony — no raise, no reopened thread.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The mainline's log routes straight to discussion; this feature went
    // to research first — the log records that shaping.
    h.write(`.workflows/${WU}/discovery/sessions/session-001.md`, [
      '# Discovery Session 001',
      '',
      'Date: 2026-01-01',
      `Work unit: ${WU}`,
      '',
      '## Description (as of session)',
      '',
      'Accept card payments at checkout.',
      '',
      '## Seed',
      '',
      '(none)',
      '',
      '## Imports',
      '',
      '(none)',
      '',
      '## Map State at Start',
      '',
      '(n/a — single-topic work)',
      '',
      '## Exploration',
      '',
      'Shaped as a single feature: accept card payments at checkout using',
      'the existing gateway account. Card-only for v1 came up early and was',
      'softly agreed; wallet support was noted as a likely deferral. Where',
      'payment telemetry should land was open ground — routed to research',
      'first, to map the instrumentation options before any decisions.',
      '',
      '## Edits',
      '',
      '(none)',
      '',
      '## Topics Identified',
      '',
      '(none)',
      '',
      '## Conclusion',
      '',
      '(none)',
      '',
    ].join('\n'));

    // The checkout flow the research counted: five modules, not four.
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

    h.engine('topic', 'start', WU, 'research', WU);
    h.write(`.workflows/${WU}/research/${WU}.md`, [
      '# Research: Payment Telemetry Placement',
      '',
      'Where payment telemetry should land in the checkout flow, and',
      'what the gateway integration already gives us for free.',
      '',
      '## Starting Point',
      '',
      'What we know so far:',
      '- Card payments at checkout use the existing gateway account',
      '- Capture is webhook-confirmed; the checkout never polls',
      '- Telemetry today is a single funnel event at order completion',
      '',
      '---',
      '',
      '## Instrumentation Surface',
      '',
      'We counted the flow before weighing placement options: the',
      'checkout spans four modules (`ls src/checkout/*.js | wc -l` → 4).',
      'Per-module boundaries beat a single funnel event — failures',
      'localise to the module that dropped the order, and the per-module',
      'shape holds at any module count.',
      '',
      'Conclusion: instrument at module boundaries — the rule is',
      'per-module, whatever the count.',
      '',
      '## Gateway Signals',
      '',
      'The gateway webhook already carries capture timing and failure',
      'codes; boundary telemetry can join against it without new gateway',
      'calls.',
      '',
      'Conclusion: reuse the webhook payload for capture-side fields.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `research(${WU}): capture threads`);
  },
};

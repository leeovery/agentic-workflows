'use strict';

// An in-progress discussion, fully decided in an earlier sitting,
// carrying a false measured claim: the Telemetry Coverage Journey
// counted the checkout flow at four modules with its recorded command,
// and the world holds five. Nothing decisive leans on the exact count
// — the telemetry decision is per-module whatever the number — so the
// resumed session's document review must catch it on the
// unverified-claims sweep, correct the value in place with the command
// re-recorded, and conclude without ceremony: no timeline entry, no
// decision revisited, no raise.

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
    h.git('add', 'src');
    h.git('commit', '-q', '-m', 'src: checkout modules');

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
    h.engine('discussion-map', 'add', WU, WU, 'gateway-integration');
    h.engine('discussion-map', 'set', WU, WU, 'gateway-integration', 'decided');
    h.engine('discussion-map', 'add', WU, WU, 'telemetry-coverage');
    h.engine('discussion-map', 'set', WU, WU, 'telemetry-coverage', 'decided');
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
  },
};

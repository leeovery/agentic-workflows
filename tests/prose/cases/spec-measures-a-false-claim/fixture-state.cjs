'use strict';

// A completed discussion carrying a false load-bearing claim about the
// tree it describes. The discussion recorded its measurement — every
// webhook handler wraps its work in withRetry — and decided against a
// reconciliation job on that basis; in the world as it stands,
// src/webhooks/refund.js does not retry, so the recorded command
// contradicts the record. Construction must verify the claim before
// extracting it, stop conversationally (the falsity undermines the
// leaning decision), land the settlement in the discussion's own
// document, reindex it, skip the sources-stale valve (single-topic),
// and continue — the spec never absorbs the defect.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The codebase the discussion measured: three webhook handlers, two
    // wrapping their work in withRetry, the refund handler bare.
    h.write('src/lib/retry.js', [
      "'use strict';",
      '',
      'async function withRetry(fn) {',
      '  for (let attempt = 1; ; attempt += 1) {',
      '    try { return await fn(); } catch (err) {',
      '      if (attempt >= 3) throw err;',
      '    }',
      '  }',
      '}',
      '',
      'module.exports = { withRetry };',
      '',
    ].join('\n'));
    h.write('src/webhooks/charge.js', [
      "'use strict';",
      '',
      "const { withRetry } = require('../lib/retry');",
      "const { applyCharge } = require('../payments');",
      '',
      'module.exports = async function charge(event) {',
      '  return withRetry(() => applyCharge(event));',
      '};',
      '',
    ].join('\n'));
    h.write('src/webhooks/capture.js', [
      "'use strict';",
      '',
      "const { withRetry } = require('../lib/retry');",
      "const { applyCapture } = require('../payments');",
      '',
      'module.exports = async function capture(event) {',
      '  return withRetry(() => applyCapture(event));',
      '};',
      '',
    ].join('\n'));
    h.write('src/webhooks/refund.js', [
      "'use strict';",
      '',
      "const { applyRefund } = require('../payments');",
      '',
      'module.exports = async function refund(event) {',
      '  return applyRefund(event);',
      '};',
      '',
    ].join('\n'));

    // The completed discussion — template-shaped, with the false
    // measured claim in Failure Handling and a Key Insight leaning on
    // it.
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
      '## Failure Handling',
      '',
      '### Context',
      'Whether transient gateway failures need a reconciliation job.',
      '',
      '### Journey',
      'We started assuming a nightly reconciliation job was unavoidable,',
      'then checked what the webhook layer already does: every webhook',
      'handler wraps its work in withRetry (`grep -L withRetry',
      'src/webhooks/*.js` → no output), so a transient failure replays',
      'safely without a sweeper.',
      '',
      '### Decision',
      'No reconciliation job for v1 — every handler retries, so replayed',
      'webhooks cover transient gateway failures. Revisit only if retry',
      'exhaustion shows up in the logs.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. The webhook layer\'s uniform retry wrapping is what makes a',
      '   reconciliation job unnecessary.',
      '',
      '### Open Threads',
      '- (none)',
      '',
      '### Current State',
      '- Gateway integration and failure handling are both resolved.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);
  },
};

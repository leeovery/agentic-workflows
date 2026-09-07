'use strict';

// A previous implementation session, killed mid-fix-round.
//
// It took up pay-1-1, the executor built it, the reviewer came back
// needs-changes, and the session recorded the attempt — then the
// session ended before the user answered the fix gate. What a fresh
// session finds is exactly this: the task in flight on the manifest,
// one attempt on the counter, the fix-tracking file holding the
// reviewer's findings, and the executor's code sitting uncommitted,
// because the task commit happens after the gates and never ran.
//
// The cache the findings were staged through is deliberately absent. A
// new session cannot count on cache surviving, and the committed
// tracking file is the record the resume has to read.
//
// Setup is settled at topic level and the environment doc exists, so
// the setup steps take their silent arms — this case is about where the
// task loop lands, not about setup.

const m = require('../../mainlines/feature.cjs');

const STAGED_FINDINGS = [
  'ISSUES:',
  '- A second checkout start mints a second payment intent.',
  '  FIX: look up the order\'s existing intent before creating one, and',
  '  return it when the gateway still reports it open.',
  '  CONFIDENCE: high — the duplicate-start criterion is untested and',
  '  the code path has no lookup at all.',
  '',
  'NOTES:',
  '- The card-only enforcement and the rejection path both read correctly.',
  '',
].join('\n');

const INTENT_SOURCE = [
  '// Create a gateway payment intent when checkout begins. Card-only is',
  '// enforced at creation and gateway rejection surfaces as a checkout',
  '// error.',
  'export function createPaymentIntent(order) {',
  "  return gateway.intents.create({ order: order.id, methods: ['card'] });",
  '}',
  '',
].join('\n');

const INTENT_TEST = [
  '// Intent created on checkout start; card-only enforced; rejection',
  '// surfaces as a checkout error.',
  "test('creates a card-only intent on checkout start', () => {});",
  '',
].join('\n');

const STAGED = '.workflows/.cache/pay/implementation/pay/attempt-findings.md';

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');
    h.engine('manifest', 'set', 'project.defaults.project_skills', '[]');
    h.engine('manifest', 'set', 'project.defaults.linters', '[]');

    h.engine('task', 'init', 'pay', 'pay');
    h.engine('manifest', 'set', 'pay.implementation.pay', 'project_skills', '[]');
    h.engine('manifest', 'set', 'pay.implementation.pay', 'linters', '[]');
    h.engine('commit', 'pay', '-m', 'impl(pay): start implementation');

    // The task in flight: started, marked in-progress in the plan, and
    // one recorded fix attempt carrying the reviewer's findings.
    h.engine('task', 'start', 'pay', 'pay', 'pay-1-1');
    h.write('.workflows/pay/planning/pay/tasks/pay-1-1.md',
      m.taskFile(m.TASKS[0], 'in-progress'));
    h.write(STAGED, STAGED_FINDINGS);
    h.engine('task', 'fix-attempt', 'pay', 'pay', 'pay-1-1', '--findings-file', STAGED);
    h.remove('.workflows/.cache/pay');
    h.engine('commit', 'pay', '-m', 'impl(pay): record Tpay-1-1 fix rounds',
      '--topic', 'implementation/pay');
    h.engine('commit', 'pay', '-m', 'impl(pay): take up Tpay-1-1', '--plan', 'pay');

    // The executor's first attempt, uncommitted — the code commit sits
    // past both gates, so a session killed at the fix gate never made it.
    h.write('src/checkout/payment-intent.js', INTENT_SOURCE);
    h.write('tests/checkout/payment-intent.test.js', INTENT_TEST);
    h.write('.world-dirt.json', JSON.stringify([
      'src/checkout/payment-intent.js',
      'tests/checkout/payment-intent.test.js',
    ], null, 2));
  },
};

'use strict';

// The mid-implementation world one step past the boundary cases: both of
// the plan's phase-1 tasks are implemented and recorded, and phase 1 has
// already closed through its consolidation pass — `consolidated_phases`
// and `completed_phases` both carry it — so the task loop finds nothing
// to run and the session routes into the analysis loop instead. The
// analysis counters are untouched: no cycle has ever run.
//
// One perturbation on top of the mainline: the concluded specification
// carries a design note naming a checkout path the tree does not have.
// Nothing is banked, so the loop's bank machinery stays out of the walk.

const fs = require('fs');
const path = require('path');

const m = require('../../mainlines/feature.cjs');

// The completed tasks' files — the shape the mainline's implement()
// writes (local-markdown authoring contract).
function taskFile(task, status) {
  return [
    '---',
    `id: ${task.id}`,
    'phase: 1',
    `status: ${status}`,
    'created: 2026-01-01',
    '---',
    '',
    `# ${task.title}`,
    '',
    task.description,
    '',
    `**Acceptance Criteria**: ${task.criteria}`,
    '',
    `**Tests**: ${task.tests}`,
    '',
  ].join('\n');
}

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);

    // The defect the analysis cycle will report: a path claim the tree
    // settles by direct measurement. Appended rather than rewritten so the
    // rest of the spec stays the mainline's.
    fs.appendFileSync(
      path.join(h.dir, `.workflows/${m.WU}/specification/${m.WU}/specification.md`),
      ['', '## Design notes', '', '- Intent creation lives in `src/checkout/intent.js`.', ''].join('\n'),
    );

    m.plan(h);
    h.engine('manifest', 'set', 'project.defaults.project_skills', '[]');
    h.engine('manifest', 'set', 'project.defaults.linters', '[]');
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');

    // The previous session: task init, both tasks executed and recorded,
    // and the phase closed through its consolidation boundary — the
    // deferred completion, the pass landing, the re-record that closes it
    // (consolidation-pass.md F).
    h.engine('task', 'init', m.WU, m.WU);
    h.engine('task', 'start', m.WU, m.WU, `${m.WU}-1-1`);
    h.write('src/checkout/payment-intent.js', [
      '// Create a gateway payment intent when checkout begins. Card-only',
      '// is enforced at creation; gateway rejection surfaces as a checkout',
      '// error and a duplicate start reuses the existing intent.',
      'export function createPaymentIntent(order) {',
      "  return gateway.intents.create({ order: order.id, methods: ['card'] });",
      '}',
      '',
    ].join('\n'));
    h.write('tests/checkout/payment-intent.test.js', [
      '// Intent created on checkout start; card-only enforced; rejection',
      '// surfaces; duplicate start does not mint a second intent.',
      "test('creates a card-only intent on checkout start', () => {});",
      '',
    ].join('\n'));
    h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${m.WU}-1-1.md`, taskFile(m.TASKS[0], 'completed'));
    h.engine('task', 'complete', m.WU, m.WU, `${m.WU}-1-1`, '--phase', '1', '--next-task', `${m.WU}-1-2`);

    h.engine('task', 'start', m.WU, m.WU, `${m.WU}-1-2`);
    h.write('src/webhooks/capture.js', [
      '// Consume gateway capture webhooks and mark the order paid. There',
      '// is no polling path; duplicate deliveries are idempotent.',
      'export function handleCaptureWebhook(event) {',
      '  return orders.markPaid(event.intentId);',
      '}',
      '',
    ].join('\n'));
    h.write('tests/webhooks/capture.test.js', [
      '// Webhook marks the order paid; duplicates are idempotent; an',
      '// unknown intent is logged and ignored.',
      "test('marks the order paid on capture webhook', () => {});",
      '',
    ].join('\n'));
    h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${m.WU}-1-2.md`, taskFile(m.TASKS[1], 'completed'));
    h.engine('task', 'complete', m.WU, m.WU, `${m.WU}-1-2`, '--phase', '1', '--next-task', '~');
    h.engine('manifest', 'push', `${m.WU}.implementation.${m.WU}`, 'consolidated_phases', '1');
    h.engine('task', 'complete', m.WU, m.WU, `${m.WU}-1-2`, '--phase', '1', '--phase-complete');

    h.write('.world-history.json', JSON.stringify([
      { message: `impl(${m.WU}): T${m.WU}-1-1 — create payment intent on checkout start`,
        files: ['src/checkout/payment-intent.js', 'tests/checkout/payment-intent.test.js'] },
      { message: `impl(${m.WU}): T${m.WU}-1-2 — handle capture webhooks`,
        files: ['src/webhooks/capture.js', 'tests/webhooks/capture.test.js'] },
    ], null, 2));
  },
};

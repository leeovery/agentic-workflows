'use strict';

// The plan is authored and the first of its two tasks is already
// implemented by a previous session: pay-1-1's code, tests, completed
// task file, and manifest bookkeeping all exist, and its task commit
// rides the world's git history. pay-1-2 is pending. The environment
// doc and empty project defaults route Steps 1, 3, and 4 to their
// short arms, exactly as in the sibling loop cases.

const m = require('../../mainlines/feature.cjs');

// The completed first task's file — same shape the mainline's
// implement() writes (local-markdown authoring contract).
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
    m.plan(h);
    h.engine('manifest', 'set', 'project.defaults.project_skills', '[]');
    h.engine('manifest', 'set', 'project.defaults.linters', '[]');
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');

    // The previous session: task init, pay-1-1 executed and recorded.
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
    h.write('.world-history.json', JSON.stringify([
      { message: `impl(${m.WU}): T${m.WU}-1-1 — create payment intent on checkout start`,
        files: ['src/checkout/payment-intent.js', 'tests/checkout/payment-intent.test.js'] },
    ], null, 2));
  },
};

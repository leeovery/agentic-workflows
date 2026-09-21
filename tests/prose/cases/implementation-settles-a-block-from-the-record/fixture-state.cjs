'use strict';

// Mid-implementation on a three-task phase, every gate `gated`. The
// previous session ran `task init` and recorded pay-1-1 complete;
// pay-1-2 (the capture consumer) and pay-1-3 (the release job) are
// pending, so this phase still has work after the task the loop picks
// up and its boundary is never reached.
//
// One perturbation on the mainline specification: an Abandoned Checkout
// section that releases the checkout page's intent at twice its
// abandonment window, states the rule and the reason, says a capture
// arriving after the release is logged and ignored — and records the
// saved-card checkout's twenty-minute abandonment without ever saying
// when that intent is released. The rule and the recorded number
// together yield the missing one; nothing in the tree carries either
// value.

const m = require('../../mainlines/feature.cjs');

const RELEASE_TASK = {
  id: `${m.WU}-1-3`,
  title: 'Release Abandoned Intents',
  description: 'Release the payment intent of a checkout the shopper never came back to.',
  criteria: 'An abandoned checkout releases its intent at the section\'s release time; a checkout the shopper returns to inside the window keeps it.',
  tests: '`releases the intent of an abandoned checkout` — a returning shopper inside the window still finds their intent.',
};

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

const ALL = [m.TASKS[0], m.TASKS[1], RELEASE_TASK];

function planThreeTasks(h) {
  h.engine('topic', 'start', m.WU, 'planning', m.WU);
  h.write(`.workflows/${m.WU}/planning/${m.WU}/planning.md`, [
    `# Plan — ${m.WU}`,
    '',
    '## Phase 1: Payment core',
    '',
    '| Task | Title |',
    '|------|-------|',
    ...ALL.map((t) => `| ${t.id} | ${t.title} |`),
    '',
  ].join('\n'));
  for (const t of ALL) {
    h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${t.id}.md`, taskFile(t, 'pending'));
  }
  h.engine('manifest', 'set', `${m.WU}.planning.${m.WU}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    ...ALL.map((t) => `task_map.${t.id}=${t.id}`),
    'storage_paths=[]');
  h.engine('manifest', 'set', `${m.WU}.planning.${m.WU}`, 'approvals.structure', '2026-01-01');
  h.engine('manifest', 'set', `${m.WU}.planning.${m.WU}`, 'approvals.tasks.p1', '2026-01-01');
  h.engine('commit', m.WU, '-m', `plan(${m.WU}): author`, '--plan', m.WU);
  h.engine('topic', 'complete', m.WU, 'planning', m.WU);
}

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);

    h.write(`.workflows/${m.WU}/specification/${m.WU}/specification.md`, m.specification([
      ...m.SPEC_SECTIONS,
      { title: '3. Abandoned Checkout', lines: [
        '- A checkout the shopper never comes back to is abandoned, and the',
        '  payment intent it opened is released: no card is left holding an',
        '  order nobody placed.',
        '- The checkout page is abandoned after 15 minutes, and the intent it',
        '  opened is released at 30 minutes — twice the abandonment window —',
        '  so a shopper who returns to a still-open checkout inside the window',
        '  always finds their payment where they left it rather than an error.',
        '- A capture naming an intent that has already been released names an',
        '  intent no order carries: it is logged and ignored.',
        '- The saved-card checkout reaches the same gateway by the same path',
        '  and is abandoned after 20 minutes.',
      ] },
    ]));

    planThreeTasks(h);
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

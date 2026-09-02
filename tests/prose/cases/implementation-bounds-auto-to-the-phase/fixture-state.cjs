'use strict';

// A two-phase plan, authored and complete, with the first task already
// implemented by a previous session: pay-1-1's code, tests, completed
// task file, and manifest bookkeeping all exist, and its task commit
// rides the world's git history. pay-1-2 (phase 1) and pay-2-1 (phase 2)
// are pending. The environment doc and empty project defaults route
// Steps 1, 3, and 4 to their short arms, exactly as in the sibling loop
// cases.

const m = require('../../mainlines/feature.cjs');

const PHASE_2_TASK = {
  id: `${m.WU}-2-1`,
  title: 'Reconcile Settlement Reports',
  description: 'Reconcile the gateway\'s daily settlement report against paid orders and list every mismatch.',
  criteria: 'Every settled intent matches a paid order or is listed; a fully matched report reconciles to an empty list; nothing is dropped silently.',
  tests: '`lists settled intents with no paid order` — a fully matched report reconciles to an empty list.',
};

// Task files in the shape the mainline's plan() writes (local-markdown
// authoring contract), with the phase carried in the frontmatter.
function taskFile(task, phase, status) {
  return [
    '---',
    `id: ${task.id}`,
    `phase: ${phase}`,
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

function planTwoPhases(h) {
  h.engine('topic', 'start', m.WU, 'planning', m.WU);
  h.write(`.workflows/${m.WU}/planning/${m.WU}/planning.md`, [
    `# Plan — ${m.WU}`,
    '',
    '## Phase 1: Payment core',
    '',
    '| Task | Title |',
    '|------|-------|',
    ...m.TASKS.map((t) => `| ${t.id} | ${t.title} |`),
    '',
    '## Phase 2: Settlement',
    '',
    '| Task | Title |',
    '|------|-------|',
    `| ${PHASE_2_TASK.id} | ${PHASE_2_TASK.title} |`,
    '',
  ].join('\n'));
  for (const t of m.TASKS) {
    h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${t.id}.md`, taskFile(t, 1, 'pending'));
  }
  h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${PHASE_2_TASK.id}.md`, taskFile(PHASE_2_TASK, 2, 'pending'));
  h.engine('manifest', 'set', `${m.WU}.planning.${m.WU}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=3', 'task=~',
    ...m.TASKS.map((t) => `task_map.${t.id}=${t.id}`),
    `task_map.${PHASE_2_TASK.id}=${PHASE_2_TASK.id}`,
    'storage_paths=[]');
  h.engine('manifest', 'set', `${m.WU}.planning.${m.WU}`, 'approvals.structure', '2026-01-01');
  h.engine('manifest', 'set', `${m.WU}.planning.${m.WU}`, 'approvals.tasks.p1', '2026-01-01');
  h.engine('manifest', 'set', `${m.WU}.planning.${m.WU}`, 'approvals.tasks.p2', '2026-01-01');
  h.engine('commit', m.WU, '-m', `plan(${m.WU}): author`, '--plan', m.WU);
  h.engine('topic', 'complete', m.WU, 'planning', m.WU);
}

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    planTwoPhases(h);
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
    h.write(`.workflows/${m.WU}/planning/${m.WU}/tasks/${m.WU}-1-1.md`, taskFile(m.TASKS[0], 1, 'completed'));
    h.engine('task', 'complete', m.WU, m.WU, `${m.WU}-1-1`, '--phase', '1', '--next-task', `${m.WU}-1-2`);
    h.write('.world-history.json', JSON.stringify([
      { message: `impl(${m.WU}): T${m.WU}-1-1 — create payment intent on checkout start`,
        files: ['src/checkout/payment-intent.js', 'tests/checkout/payment-intent.test.js'] },
    ], null, 2));
  },
};

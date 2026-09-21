'use strict';

// Mid-implementation on a three-task phase, every gate `gated`. The
// previous session ran `task init` and recorded pay-1-1 complete;
// pay-1-2 (the capture consumer) and pay-1-3 (the checkout error
// surface) are pending, so this phase still has work after the task the
// loop picks up and its boundary is never reached.
//
// The discussion concluded in the template's own shape — one decided
// subtopic and a summary — and the specification was extracted from it.
// Between them they decide everything the capture consumer needs: it is
// confirmed by webhook and never polled, repeat deliveries are
// idempotent, and a capture naming an intent no order carries is logged
// and ignored. Nothing here is undecided — what the executor cannot do
// is make its own idempotency test pass, which is a failure and not a
// question.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

const DISCUSSION = [
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
  'Which account the checkout uses, and how a capture is confirmed.',
  '',
  '### Options Considered',
  '',
  '**Poll the gateway from the checkout**',
  '- Pros: the checkout can answer the shopper on the spot.',
  '- Cons: it answers with a guess whenever the gateway is slow.',
  '',
  '**Wait for the gateway to tell us**',
  '- Pros: the answer is the gateway\'s own, and it is repeated if the',
  '  first attempt fails.',
  '- Cons: it arrives after the checkout has handed the shopper on.',
  '',
  '### Journey',
  'The existing account carries the rates we already have, so a new',
  'provider was never seriously on the table. Confirmation was the real',
  'question. Polling looked attractive until we followed a slow gateway',
  'through it: the checkout would have to answer the shopper with a',
  'guess, and a wrong guess about money is worse than a slower answer.',
  'We settled on webhooks — the gateway tells us, and it tells us again',
  'if the first attempt fails.',
  '',
  '### Decision',
  'Use the existing gateway account — no new provider onboarding.',
  'Capture is confirmed by gateway webhook; the checkout never polls.',
  '',
  '---',
  '',
  '## Summary',
  '',
  '### Key Insights',
  '1. Confirmation is asynchronous by design: the checkout hands the',
  '   shopper to the gateway and hears back afterwards, and nothing in',
  '   the flow waits on a poll.',
  '',
  '### Open Threads',
  '- (none)',
  '',
  '### Current State',
  '- Gateway integration is resolved.',
  '',
].join('\n');

const ERROR_TASK = {
  id: `${WU}-1-3`,
  title: 'Surface Checkout Errors',
  description: 'Show the shopper a checkout error the gateway refused the intent, rather than a page that never advances.',
  criteria: 'A gateway rejection at intent creation surfaces as a user-visible checkout error.',
  tests: '`shows a checkout error when the gateway refuses the intent`.',
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

const ALL = [m.TASKS[0], m.TASKS[1], ERROR_TASK];

function planThreeTasks(h) {
  h.engine('topic', 'start', WU, 'planning', WU);
  h.write(`.workflows/${WU}/planning/${WU}/planning.md`, [
    `# Plan — ${WU}`,
    '',
    '## Phase 1: Payment core',
    '',
    '| Task | Title |',
    '|------|-------|',
    ...ALL.map((t) => `| ${t.id} | ${t.title} |`),
    '',
  ].join('\n'));
  for (const t of ALL) {
    h.write(`.workflows/${WU}/planning/${WU}/tasks/${t.id}.md`, taskFile(t, 'pending'));
  }
  h.engine('manifest', 'set', `${WU}.planning.${WU}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    ...ALL.map((t) => `task_map.${t.id}=${t.id}`),
    'storage_paths=[]');
  h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.structure', '2026-01-01');
  h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.tasks.p1', '2026-01-01');
  h.engine('commit', WU, '-m', `plan(${WU}): author`, '--plan', WU);
  h.engine('topic', 'complete', WU, 'planning', WU);
}

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, DISCUSSION);
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);

    m.specify(h);
    planThreeTasks(h);

    h.engine('manifest', 'set', 'project.defaults.project_skills', '[]');
    h.engine('manifest', 'set', 'project.defaults.linters', '[]');
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');

    // The previous session: task init, pay-1-1 executed and recorded.
    h.engine('task', 'init', WU, WU);
    h.engine('task', 'start', WU, WU, `${WU}-1-1`);
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
    h.write(`.workflows/${WU}/planning/${WU}/tasks/${WU}-1-1.md`, taskFile(m.TASKS[0], 'completed'));
    h.engine('task', 'complete', WU, WU, `${WU}-1-1`, '--phase', '1', '--next-task', `${WU}-1-2`);

    h.write('.world-history.json', JSON.stringify([
      { message: `impl(${WU}): T${WU}-1-1 — create payment intent on checkout start`,
        files: ['src/checkout/payment-intent.js', 'tests/checkout/payment-intent.test.js'] },
    ], null, 2));
  },
};

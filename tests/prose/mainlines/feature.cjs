'use strict';

// The canonical feature mainline — `pay`, a payments feature — as staged
// builders each fixture recipe composes a prefix of. Engine calls mirror
// the sequences the skill prose prescribes (the same sequences
// tests/scripts/test-pipeline-simulation.cjs replays); content files are
// the artifacts a real run leaves, in the shape downstream prose reads
// (local-markdown task files per the format's authoring.md).
//
// Dates are literals matching the frozen recipe clock (2026-01-01).

const WU = 'pay';

function init(h) {
  h.knowledge('setup', '--keyword-only');
  h.engine('boot');
}

function create(h) {
  // Shape per workflow-discovery/references/template.md + confirm-trigger.md:
  // single-phase work backfills Exploration at creation; Edits, Topics
  // Identified, and Conclusion land as (none).
  const log = `.workflows/${WU}/discovery/sessions/session-001.md`;
  h.write(log, [
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
    'softly agreed; wallet support was noted as a likely deferral. No',
    'research need surfaced — routed straight to discussion.',
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
  h.engine('workunit', 'create', WU, 'feature',
    '--description', 'Accept card payments at checkout',
    '--session-log-file', log);
}

function discuss(h) {
  h.engine('topic', 'start', WU, 'discussion', WU);
  h.write(`.workflows/${WU}/discussion/${WU}.md`, [
    `# Discussion — ${WU}`,
    '',
    '## Context',
    '',
    'Accept card payments at checkout using the existing gateway account.',
    '',
    '## Decisions',
    '',
    '- Use the existing gateway account; no new provider onboarding.',
    '- Card-only for v1 — wallet support is deferred.',
    '- Webhooks confirm capture; the checkout never polls.',
    '',
    '## Deferred',
    '',
    '- Wallet support (Apple/Google Pay) — revisit after v1.',
    '',
  ].join('\n'));
  h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
  h.engine('topic', 'complete', WU, 'discussion', WU);
}

function specify(h) {
  h.engine('topic', 'start', WU, 'specification', WU);
  h.engine('manifest', 'set', `${WU}.specification.${WU}`, `sources.${WU}.status`, 'pending');
  h.write(`.workflows/${WU}/specification/${WU}/specification.md`, [
    `# Specification — ${WU}`,
    '',
    '## Requirements',
    '',
    '- Checkout creates a payment intent against the existing gateway account.',
    '- Card payments only; wallet flows are out of scope for v1.',
    '- Capture is confirmed by gateway webhook, never by polling.',
    '',
    '## Out of scope',
    '',
    '- Wallet support (deferred by discussion).',
    '',
  ].join('\n'));
  h.engine('manifest', 'set', `${WU}.specification.${WU}`, `sources.${WU}.status`, 'incorporated');
  h.engine('commit', WU, '-m', `spec(${WU}): construct`);
  h.engine('topic', 'complete', WU, 'specification', WU);
}

const TASKS = [
  { id: `${WU}-1-1`, title: 'Create Payment Intent', description: 'Create a gateway payment intent when checkout begins and attach it to the order.' },
  { id: `${WU}-1-2`, title: 'Handle Capture Webhooks', description: 'Consume gateway capture webhooks and mark the order paid; no polling path.' },
];

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
  ].join('\n');
}

function plan(h) {
  h.engine('topic', 'start', WU, 'planning', WU);
  h.write(`.workflows/${WU}/planning/${WU}/planning.md`, [
    `# Plan — ${WU}`,
    '',
    '## Phase 1: Payment core',
    '',
    '| Task | Title |',
    '|------|-------|',
    ...TASKS.map((t) => `| ${t.id} | ${t.title} |`),
    '',
  ].join('\n'));
  for (const t of TASKS) {
    h.write(`.workflows/${WU}/planning/${WU}/tasks/${t.id}.md`, taskFile(t, 'pending'));
  }
  h.engine('manifest', 'set', `${WU}.planning.${WU}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    ...TASKS.map((t) => `task_map.${t.id}=${t.id}`),
    'storage_paths=[]');
  h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.structure', '2026-01-01');
  h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.tasks.p1', '2026-01-01');
  h.engine('commit', WU, '-m', `plan(${WU}): author`, '--plan', WU);
  h.engine('topic', 'complete', WU, 'planning', WU);
}

// A plan authored to the end of construction — structure and task
// tables approved, every task written to local-markdown — but not yet
// graphed, reviewed, or concluded. spec_commit carries the world
// builder's `@WORLD_COMMIT@` placeholder: a recipe cannot know a SHA,
// and materialise resolves it to the world's baseline commit.
const P2_TASK = { id: `${WU}-2-1`, title: 'Handle Capture Webhooks', description: 'Consume gateway capture webhooks and mark the order paid; no polling path.' };

function planAuthored(h) {
  h.engine('topic', 'start', WU, 'planning', WU);
  h.write(`.workflows/${WU}/planning/${WU}/planning.md`, [
    `# Plan: Pay`,
    '',
    '## Phase 1: Payment Intent Core',
    '',
    '**Goal**: Checkout creates a gateway payment intent and attaches it to the order.',
    '',
    '**Acceptance criteria**: An intent is created when checkout begins; the order carries the intent id; card-only is enforced.',
    '',
    '| Task | Summary | Edge cases |',
    '|------|---------|------------|',
    '| Create Payment Intent | Create a gateway payment intent when checkout begins, card-only enforced. | Gateway rejects the intent; duplicate checkout start |',
    '| Attach Intent To Order | Persist the intent id on the order for later capture confirmation. | Order abandoned before payment; intent id missing on retry |',
    '',
    '## Phase 2: Webhook Capture',
    '',
    '**Goal**: Capture is confirmed exclusively by gateway webhooks.',
    '',
    '**Acceptance criteria**: The webhook consumer marks orders paid; no polling path exists anywhere.',
    '',
    '| Task | Summary | Edge cases |',
    '|------|---------|------------|',
    '| Handle Capture Webhooks | Consume gateway capture webhooks and mark the order paid. | Duplicate webhook delivery; webhook for an unknown intent |',
    '',
  ].join('\n'));
  h.write(`.workflows/${WU}/planning/${WU}/phase-1-tasks.md`, [
    '# Phase 1: Payment Intent Core — 2 tasks',
    '',
    `## ${WU}-1-1`,
    '',
    '### Task 1: Create Payment Intent',
    '',
    '**Problem**: Checkout has no way to open a payment against the gateway.',
    '**Solution**: Create a gateway payment intent when checkout begins, card-only enforced.',
    '**Outcome**: Every checkout start yields exactly one intent.',
    '',
    `## ${WU}-1-2`,
    '',
    '### Task 2: Attach Intent To Order',
    '',
    '**Problem**: Capture confirmation cannot find the payment without a link from the order.',
    '**Solution**: Persist the intent id on the order at creation time.',
    '**Outcome**: Every order carries its intent id.',
    '',
  ].join('\n'));
  h.write(`.workflows/${WU}/planning/${WU}/phase-2-tasks.md`, [
    '# Phase 2: Webhook Capture — 1 task',
    '',
    `## ${WU}-2-1`,
    '',
    '### Task 1: Handle Capture Webhooks',
    '',
    '**Problem**: Orders are never marked paid without a confirmation path.',
    '**Solution**: Consume gateway capture webhooks and mark the order paid.',
    '**Outcome**: Paid orders reflect capture with no polling anywhere.',
    '',
  ].join('\n'));
  const AUTHORED = [
    TASKS[0],
    { id: `${WU}-1-2`, title: 'Attach Intent To Order', description: 'Persist the intent id on the order for later capture confirmation.' },
    P2_TASK,
  ];
  for (const t of AUTHORED) {
    const phase = t.id.split('-')[1];
    h.write(`.workflows/${WU}/planning/${WU}/tasks/${t.id}.md`, [
      '---', `id: ${t.id}`, `phase: ${phase}`, 'status: pending', 'created: 2026-01-01', '---',
      '', `# ${t.title}`, '', t.description, '',
    ].join('\n'));
  }
  h.engine('manifest', 'set', `${WU}.planning.${WU}`,
    'format=local-markdown', 'spec_commit=@WORLD_COMMIT@',
    'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=3', 'task=~', `external_id=${WU}`,
    `task_map.${WU}-1=${WU}-1`, `task_map.${WU}-1-1=${WU}-1-1`, `task_map.${WU}-1-2=${WU}-1-2`,
    `task_map.${WU}-2=${WU}-2`, `task_map.${WU}-2-1=${WU}-2-1`,
    'storage_paths=[]');
  h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.structure', '2026-01-01');
  h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.tasks.p1', '2026-01-01');
  h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.tasks.p2', '2026-01-01');
  h.engine('commit', WU, '-m', `plan(${WU}): author all phases`, '--plan', WU);
}

// The graph applied on top of planAuthored: dependencies and
// priorities in the task files' frontmatter, as the grapher leaves
// them, with the analyze commit recorded.
function planGraphed(h) {
  const graphed = [
    { id: `${WU}-1-1`, title: 'Create Payment Intent', description: 'Create a gateway payment intent when checkout begins, card-only enforced.', extra: ['priority: 1'] },
    { id: `${WU}-1-2`, title: 'Attach Intent To Order', description: 'Persist the intent id on the order for later capture confirmation.', extra: ['priority: 2', 'depends_on:', `  - ${WU}-1-1`] },
    { id: `${WU}-2-1`, title: 'Handle Capture Webhooks', description: 'Consume gateway capture webhooks and mark the order paid; no polling path.', extra: ['depends_on:', `  - ${WU}-1-2`] },
  ];
  for (const t of graphed) {
    const phase = t.id.split('-')[1];
    h.write(`.workflows/${WU}/planning/${WU}/tasks/${t.id}.md`, [
      '---', `id: ${t.id}`, `phase: ${phase}`, 'status: pending', 'created: 2026-01-01', ...t.extra, '---',
      '', `# ${t.title}`, '', t.description, '',
    ].join('\n'));
  }
  h.engine('commit', WU, '-m', `planning(${WU}): analyze task dependencies and priorities`, '--plan', WU);
}

function implement(h) {
  // No `topic start` here: implementation is the one phase whose prose
  // never issues it — `task init` owns creation (process Step 0, the
  // created arm), and only that arm writes the full field set. The
  // code commits are declared as world history (per-task messages in
  // the task-loop's convention) so a materialised world's git log
  // carries what the review scope-grep reads.
  h.engine('task', 'init', WU, WU);
  h.engine('task', 'start', WU, WU, `${WU}-1-1`);
  h.write('src/checkout/payment-intent.js', [
    "// Create a gateway payment intent when checkout begins. Card-only",
    "// is enforced at creation; gateway rejection surfaces as a checkout",
    "// error and a duplicate start reuses the existing intent.",
    "export function createPaymentIntent(order) {",
    "  return gateway.intents.create({ order: order.id, methods: ['card'] });",
    "}",
    "",
  ].join('\n'));
  h.write('tests/checkout/payment-intent.test.js', [
    "// Intent created on checkout start; card-only enforced; rejection",
    "// surfaces; duplicate start does not mint a second intent.",
    "test('creates a card-only intent on checkout start', () => {});",
    "",
  ].join('\n'));
  h.write(`.workflows/${WU}/planning/${WU}/tasks/${WU}-1-1.md`, taskFile(TASKS[0], 'completed'));
  h.engine('task', 'complete', WU, WU, `${WU}-1-1`, '--next-task', `${WU}-1-2`);
  h.engine('task', 'start', WU, WU, `${WU}-1-2`);
  h.write('src/webhooks/capture.js', [
    "// Consume gateway capture webhooks and mark the order paid. There",
    "// is no polling path; duplicate deliveries are idempotent.",
    "export function handleCaptureWebhook(event) {",
    "  return orders.markPaid(event.intentId);",
    "}",
    "",
  ].join('\n'));
  h.write('tests/webhooks/capture.test.js', [
    "// Webhook marks the order paid; duplicates are idempotent; an",
    "// unknown intent is logged and ignored.",
    "test('marks the order paid on capture webhook', () => {});",
    "",
  ].join('\n'));
  h.write(`.workflows/${WU}/planning/${WU}/tasks/${WU}-1-2.md`, taskFile(TASKS[1], 'completed'));
  h.engine('task', 'complete', WU, WU, `${WU}-1-2`, '--next-task', '~', '--phase-complete');
  h.write('.world-history.json', JSON.stringify([
    { message: `impl(${WU}): T${WU}-1-1 — create payment intent`,
      files: ['src/checkout/payment-intent.js', 'tests/checkout/payment-intent.test.js'] },
    { message: `impl(${WU}): T${WU}-1-2 — handle capture webhooks`,
      files: ['src/webhooks/capture.js', 'tests/webhooks/capture.test.js'] },
  ], null, 2));
  h.engine('commit', WU, '-m', `impl(${WU}): complete implementation`);
  h.engine('topic', 'complete', WU, 'implementation', WU);
}

module.exports = { WU, TASKS, P2_TASK, init, create, discuss, specify, plan, planAuthored, planGraphed, implement };

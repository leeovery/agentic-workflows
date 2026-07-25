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

function implement(h) {
  // No `topic start` here: implementation is the one phase whose prose
  // never issues it — `task init` owns creation (process Step 0, the
  // created arm), and only that arm writes the full field set.
  h.engine('task', 'init', WU, WU);
  h.engine('task', 'start', WU, WU, `${WU}-1-1`);
  h.write(`.workflows/${WU}/planning/${WU}/tasks/${WU}-1-1.md`, taskFile(TASKS[0], 'completed'));
  h.engine('task', 'complete', WU, WU, `${WU}-1-1`, '--next-task', `${WU}-1-2`);
  h.engine('task', 'start', WU, WU, `${WU}-1-2`);
  h.write(`.workflows/${WU}/planning/${WU}/tasks/${WU}-1-2.md`, taskFile(TASKS[1], 'completed'));
  h.engine('task', 'complete', WU, WU, `${WU}-1-2`, '--next-task', '~', '--phase-complete');
  h.engine('commit', WU, '-m', `impl(${WU}): phase 1 complete`);
  h.engine('topic', 'complete', WU, 'implementation', WU);
}

module.exports = { WU, TASKS, init, create, discuss, specify, plan, implement };

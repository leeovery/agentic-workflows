'use strict';

// A plan one step past `planning-shapes-the-phases`: the specification
// concluded, the plan registered on local-markdown, the two-phase
// structure approved and Phase 1's task table designed and approved —
// and not one task authored. The position sits at Phase 1 on its first
// task, `task_map` is empty, and no task detail file exists, so
// construction's next move is the task author.
//
// One perturbation on the mainline specification: a client-bounds
// section requires both of the checkout path's synchronous external
// calls to run under an explicit client timeout, bounds intent creation
// at 4 seconds and records the rule it was set by (twice the gateway's
// documented p99 of 2 seconds), records the orders store's documented
// p99 of 250 milliseconds for the single-order write that attaches the
// intent — and never states that call's bound. The bounds live on the
// shared client configuration, which is ambient, so no file in the tree
// carries either value.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

// The planning file as construction leaves it once Phase 1's task list
// is approved: the designer's phase structure, and its Phase 1 table.
const PLAN = [
  '# Plan: Pay',
  '',
  '## Phase 1: Payment Intent Core',
  '',
  '**Goal**: Checkout creates a gateway payment intent and attaches it to the order.',
  '',
  '**Acceptance criteria**: An intent is created when checkout begins; the order carries the intent id; card-only is enforced at intent creation.',
  '',
  '**Ordering rationale**: The intent is the substrate every later behaviour confirms against.',
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
  '**Ordering rationale**: Capture confirmation depends on intents existing.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);

    h.engine('topic', 'start', WU, 'specification', WU);
    h.engine('manifest', 'set', `${WU}.specification.${WU}`, `sources.${WU}.status`, 'pending');
    h.write(`.workflows/${WU}/specification/${WU}/specification.md`, m.specification([
      ...m.SPEC_SECTIONS,
      { title: '3. Client Call Bounds', lines: [
        "The checkout path makes two synchronous external calls — the intent",
        "creation against the gateway, and the write that attaches the intent",
        'to the order against the orders store. Both run under explicit client',
        'timeouts, configured once on the shared clients rather than at the',
        'call sites: a hung dependency must never stall the checkout.',
        '',
        "- Intent creation: bounded at 4 seconds — twice the gateway's",
        '  documented p99 of 2 seconds for intent creation, so a healthy slow',
        '  call never trips the bound while a hung gateway cannot hold the',
        '  checkout open.',
        "- Attaching the intent to the order: the platform documents the orders",
        "  store's p99 at 250 milliseconds for single-order writes.",
      ] },
    ]));
    h.engine('manifest', 'set', `${WU}.specification.${WU}`, `sources.${WU}.status`, 'incorporated');
    h.engine('commit', WU, '-m', `spec(${WU}): construct`);
    h.engine('topic', 'complete', WU, 'specification', WU);

    // The previous planning sitting: format chosen and recorded as the
    // project default, plan registered, phase structure approved, and
    // Phase 1's task list designed and approved.
    h.engine('manifest', 'set', 'project.defaults.plan_format', 'local-markdown');
    h.engine('topic', 'start', WU, 'planning', WU);
    h.write(`.workflows/${WU}/planning/${WU}/planning.md`, PLAN);
    h.engine('manifest', 'set', `${WU}.planning.${WU}`,
      'format=local-markdown', 'spec_commit=@WORLD_COMMIT@',
      'task_list_gate_mode=gated', 'author_gate_mode=gated', 'finding_gate_mode=gated',
      'review_cycle=0', 'phase=1', `task=${WU}-1-1`, 'task_map={}', 'storage_paths=[]');
    h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.structure', '2026-01-01');
    h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.tasks.p1', '2026-01-01');
    h.engine('commit', WU, '-m', `planning(${WU}): approve Phase 1 task list`, '--plan', WU);
  },
};

'use strict';

// A plan mid-construction: the specification concluded, the plan
// registered on local-markdown, the two-phase structure designed and
// approved — and Phase 1 carrying no task table, so construction's next
// move is the task designer.
//
// One perturbation on the mainline specification: a client-bounds
// section requires both of Phase 1's synchronous external calls to run
// under an explicit client timeout, bounds intent creation at 4 seconds
// and records the rule it was set by (twice the gateway's documented p99
// of 2 seconds), records the orders store's documented p99 of 250
// milliseconds for the single-order write the intent attachment makes —
// and never states that call's bound. The bounds live on the shared
// client configuration, which is ambient, so no file in the tree carries
// either value and nothing here is measurable against it.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

// The phase-designer's product, approved in an earlier sitting: goals,
// acceptance criteria and ordering rationale, no task tables.
const PHASES = [
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

    // The previous planning sitting: the format chosen and recorded as the
    // project default, the plan registered, the phase structure designed
    // and approved. The position sits at phase 1 with no task designed.
    h.engine('manifest', 'set', 'project.defaults.plan_format', 'local-markdown');
    h.engine('topic', 'start', WU, 'planning', WU);
    h.write(`.workflows/${WU}/planning/${WU}/planning.md`, PHASES);
    h.engine('manifest', 'set', `${WU}.planning.${WU}`,
      'format=local-markdown', 'spec_commit=@WORLD_COMMIT@',
      'task_list_gate_mode=gated', 'author_gate_mode=gated', 'finding_gate_mode=gated',
      'review_cycle=0', 'phase=1', 'task=~', 'task_map={}', 'storage_paths=[]');
    h.engine('manifest', 'set', `${WU}.planning.${WU}`, 'approvals.structure', '2026-01-01');
    h.engine('commit', WU, '-m', `planning(${WU}): approve phase structure`, '--plan', WU);
  },
};

'use strict';

// A plan mid-construction: the discussion concluded, the specification
// extracted from it and concluded, the plan registered on local-markdown
// with its two-phase structure designed and approved in an earlier
// sitting — and Phase 1 carrying no task table, so construction's next
// move is to put the existing structure up for confirmation.
//
// The project has no roadmap: no horizons, no items, no roadmap node on
// the project manifest. The inbox is empty too — the aside this case
// walks has nowhere it could already be.

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
    m.specify(h);

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

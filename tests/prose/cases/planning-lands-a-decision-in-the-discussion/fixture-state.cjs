'use strict';

// A plan mid-construction: the discussion concluded in the template's
// own shape, the specification extracted from it and concluded, the plan
// registered on local-markdown with its two-phase structure designed and
// approved — and Phase 1 carrying no task table, so construction's next
// move is the task designer.
//
// The record settles that capture is confirmed out of band and never
// polled, and that a rejection at intent creation surfaces as a checkout
// error. Neither document says what the shopper is shown in the window
// between submitting checkout and the capture webhook arriving: the
// discussion never raised it, and the specification, which records no
// decisions of its own, could not invent one. That is the fork the task
// designer reports.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

// The concluded discussion, in the template's subtopic shape — one
// decided subtopic and a summary. Nothing here decides what the shopper
// meets while a capture is outstanding.
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

    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, DISCUSSION);
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);

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

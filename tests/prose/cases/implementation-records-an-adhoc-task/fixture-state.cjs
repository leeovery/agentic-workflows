'use strict';

// The plan is authored and complete, and the environment shortcuts from
// implementation-executes-the-loop apply (setup doc present, skills and
// linters defaulted empty). On top of that, the world carries the drift
// this case exists to resist: a third task (pay-1-3) added out-of-band
// after planning — present in the backend and task_map, given a full
// section in phase-1-tasks.md by hand along with a bumped `total:`
// frontmatter count, and absent from planning.md's task table. The
// artifact state reads as a local convention ("later tasks go in
// phase-1-tasks.md; planning.md is frozen") that no prose anywhere
// prescribes. A correct walk records the new ad hoc task in planning.md
// and leaves phase-1-tasks.md alone.

const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    m.plan(h);
    h.write('.workflows/pay/planning/pay/planning.md', [
      '# Plan — pay',
      '',
      '## Phase 1: Payment core',
      '',
      '**Goal**: Checkout creates and confirms card payments against the existing gateway account.',
      '',
      '#### Tasks',
      '',
      '| Internal ID | Name | Edge Cases |',
      '|-------------|------|------------|',
      '| pay-1-1 | Create Payment Intent | Gateway rejects the intent; duplicate checkout start |',
      '| pay-1-2 | Handle Capture Webhooks | Duplicate webhook delivery; webhook for an unknown intent |',
      '',
    ].join('\n'));
    h.write('.workflows/pay/planning/pay/phase-1-tasks.md', [
      '---',
      'total: 3',
      '---',
      '',
      '# Phase 1: Payment core — 2 tasks',
      '',
      '## pay-1-1',
      '',
      '### Task 1: Create Payment Intent',
      '',
      '**Problem**: Checkout has no way to open a payment against the gateway.',
      '**Solution**: Create a gateway payment intent when checkout begins, card-only enforced.',
      '**Outcome**: Every checkout start yields exactly one intent.',
      '',
      '## pay-1-2',
      '',
      '### Task 2: Handle Capture Webhooks',
      '',
      '**Problem**: Orders are never marked paid without a confirmation path.',
      '**Solution**: Consume gateway capture webhooks and mark the order paid.',
      '**Outcome**: Paid orders reflect capture with no polling anywhere.',
      '',
      '## pay-1-3',
      '',
      '### Task 3: Log Gateway Errors',
      '',
      '**Problem**: Gateway failures vanish without a trace for support.',
      '**Solution**: Log every gateway error response with the intent and order ids.',
      '**Outcome**: Support can trace any failed payment from the log.',
      '',
    ].join('\n'));
    h.write('.workflows/pay/planning/pay/tasks/pay-1-3.md', [
      '---',
      'id: pay-1-3',
      'phase: 1',
      'status: pending',
      'created: 2026-01-01',
      '---',
      '',
      '# Log Gateway Errors',
      '',
      'Log every gateway error response with the intent id and order id for support triage.',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', 'pay.planning.pay', 'task_map.pay-1-3', 'pay-1-3');
    h.engine('manifest', 'set', 'project.defaults.project_skills', '[]');
    h.engine('manifest', 'set', 'project.defaults.linters', '[]');
    h.write('.workflows/.state/environment-setup.md', 'No special setup required.\n');
  },
};

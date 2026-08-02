'use strict';

// A world where migration 054's exact-match parser has a blind spot to
// find: synonym-handling's reopened discussion carries a malformed triage
// heading ("## Triage:" — trailing colon) holding a real parked entry, and
// the migrations log has 054 un-recorded, so the next boot runs it live.
// The code migration skips the malformed section (no exact match), reports
// the no-match verify addendum, and workflow-start's judgment pass owns
// recovering the straggler.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('topic', 'reopen', WU, 'discussion', 'synonym-handling');
    h.write(`.workflows/${WU}/discussion/synonym-handling.md`, [
      '# Discussion: Synonym Handling',
      '',
      '## Context',
      '',
      'Reopened to revisit expansion freshness against batch-only signals.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Reopened; nothing re-decided yet.',
      '',
      '## Triage:',
      '',
      '### Stale Concern',
      '*From: behavioural-ranking · discussion · 2026-01-02*',
      '',
      'Expansion freshness assumptions rest on a live click-signal stream',
      'that behavioural-ranking decided will not be built. The freshness',
      'question needs re-deciding against batch-only signals.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', 'discussion/synonym-handling', '-m',
      `discussion(${WU}): reopen synonym-handling with a stale parked concern`);

    // Un-record 054 so the walk's boot runs it against this world.
    h.write('.workflows/.state/migrations',
      Array.from({ length: 53 }, (_, i) => String(i + 1).padStart(3, '0')).join('\n') + '\n');
    h.engine('commit', '--workflows', '-m', 'chore: rewind migration state for the walk');
  },
};

'use strict';

// A world where migration 054's exact-match parser has a blind spot to
// find: synonym-handling's reopened discussion carries a malformed triage
// heading ("## Triage:" — trailing colon) holding a real parked entry, and
// the migrations log has 054 and 071 un-recorded — an install behind at 054
// is behind at 071 too — so the next boot runs both live. 054 skips the
// malformed section (no exact match) and reports the no-match verify
// addendum; 071 finds the heading and hands back the mailbox path that
// corrects where 054's addendum sends the straggler; workflow-start's
// judgment pass owns recovering it.

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

    // Record every shipped migration except 054 and 071, so the walk's boot
    // runs exactly those two against this world — durable as new migrations
    // land.
    const migrationsDir = require('path').join(
      __dirname, '..', '..', '..', '..',
      'skills', 'workflow-migrate', 'scripts', 'migrations'
    );
    const recorded = require('fs').readdirSync(migrationsDir)
      .map((f) => (f.match(/^(\d+)-/) || [])[1])
      .filter((id) => id && id !== '054' && id !== '071')
      .sort();
    h.write('.workflows/.state/migrations', recorded.join('\n') + '\n');
    h.engine('commit', '--workflows', '-m', 'chore: rewind migration state for the walk');
  },
};

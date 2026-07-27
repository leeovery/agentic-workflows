'use strict';

// Quick-fix mainline: the smallest pipeline shape. Discovery shapes the
// work and commits it; scoping is the whole definition stage in one pass.
//
// The Exploration deliberately holds the what and the why but not the
// where. Scoping's gather-context skips its questions when the carrier
// already captures all three, and that guard is a judgement call — a
// carrier that plainly lacks the where makes the questioning arm the only
// honest reading, which is what the scoping case needs to exercise.

const WU = 'support-email';

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
    'Replace the retired support email address with the new one.',
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
    'The support@ mailbox is being retired at the end of the month and',
    'mail to it already bounces for some customers; everything should',
    'point at help@ instead. Purely mechanical — same links, same copy,',
    'different address. The user was not sure everywhere it appears and',
    'wants that pinned down during scoping. Confirmed as a quick-fix.',
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
  h.engine('workunit', 'create', WU, 'quick-fix',
    '--description', 'Replace the retired support email address with the new one',
    '--session-log-file', log);
}

module.exports = { WU, init, create };

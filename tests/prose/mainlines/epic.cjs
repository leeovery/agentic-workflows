'use strict';

// The canonical epic mainline — `search-relevance`, a search-quality
// overhaul — as staged builders each fixture recipe composes a prefix
// of. Engine calls mirror the sequences the skill prose prescribes (the
// same sequences tests/scripts/test-pipeline-simulation.cjs replays).
//
// `create` reproduces the confirm-trigger's work-type commit and stops
// there: the log's Exploration holds the shaping conversation, the map
// is empty, and the engine-set active_session marker is left in place —
// the epic equivalent of walking away right after creation, which is an
// interrupted sketch the next discovery entry resumes.
//
// Dates are literals matching the frozen recipe clock (2026-01-01).

const WU = 'search-relevance';

function init(h) {
  h.knowledge('setup', '--keyword-only');
  h.engine('boot');
}

function create(h) {
  // Shape per workflow-discovery/references/template.md + confirm-trigger.md:
  // header, carrier sections, Exploration backfilled from the shaping,
  // Edits / Topics Identified / Conclusion left as (none).
  const log = `.workflows/${WU}/discovery/sessions/session-001.md`;
  h.write(log, [
    '# Discovery Session 001',
    '',
    'Date: 2026-01-01',
    `Work unit: ${WU}`,
    '',
    '## Description (as of session)',
    '',
    'Overhaul search relevance across the catalogue.',
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
    '(empty — first session)',
    '',
    '## Exploration',
    '',
    'Search relevance across the catalogue is poor, and the shaping',
    'settled that it is several problems at once rather than one.',
    'Ranking barely uses behavioural signals — click and purchase events',
    'land in the events pipeline but nothing feeds them back into the',
    'ranker. Synonyms and misspellings are handled by a hand-maintained',
    'list nobody trusts. And there is no way to tell whether a relevance',
    'change makes results better or worse, so every tweak is decided by',
    'argument. Agreed to take the whole area on as one epic rather than',
    'patch a single piece; the parts still need exploring properly',
    'before any topics are named.',
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
  h.engine('workunit', 'create', WU, 'epic',
    '--description', 'Overhaul search relevance across the catalogue',
    '--session-log-file', log);
}

module.exports = { WU, init, create };

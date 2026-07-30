'use strict';

// The canonical cross-cutting mainline — `error-handling`, a
// project-level error-handling standard — as staged builders each
// fixture recipe composes a prefix of. Engine calls mirror the
// sequences the skill prose prescribes; content files are the
// artifacts a real run leaves. Cross-cutting is terminal at
// specification, so the mainline ends with the completed discussion —
// the state a specification walk starts from.
//
// Dates are literals matching the frozen recipe clock (2026-01-01).

const WU = 'error-handling';

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
    'Standardise error handling across services.',
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
    'Every service shapes its errors differently, so callers branch on',
    'shapes instead of meanings and retry logic is guesswork. Shaped as',
    'a cross-cutting concern: define one error contract for all',
    'services — an envelope, a retryable/terminal classification, and',
    'boundary logging — rather than change any one service. The',
    'standard is the deliverable; adoption lands per-service later.',
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
  h.engine('workunit', 'create', WU, 'cross-cutting',
    '--description', 'Standardise error handling across services',
    '--session-log-file', log);
}

function discuss(h) {
  h.engine('topic', 'start', WU, 'discussion', WU);
  h.write(`.workflows/${WU}/discussion/${WU}.md`, [
    `# Discussion — ${WU}`,
    '',
    '## Context',
    '',
    'Define one error contract for every service: envelope, retry',
    'classification, and boundary logging.',
    '',
    '## Decisions',
    '',
    '- Every service returns one error envelope: code, message,',
    '  correlation_id. No service-specific shapes.',
    '- Retryable versus terminal is carried by the code range —',
    '  callers classify from the code alone, never from message text.',
    '- Errors are logged once, at the service boundary, with the',
    '  correlation id — inner layers rethrow without logging.',
    '',
    '## Deferred',
    '',
    '- Client SDK helper library — revisit once the contract has',
    '  landed in two services.',
    '',
  ].join('\n'));
  h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
  h.engine('topic', 'complete', WU, 'discussion', WU);
}

module.exports = { WU, init, create, discuss };

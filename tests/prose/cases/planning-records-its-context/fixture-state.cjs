'use strict';

// The feature is specified; planning has not begun, and local-markdown is
// the project's default plan format. Beside it, a cross-cutting standard
// for inbound webhooks has concluded its specification — the plan's
// capture webhooks fall under it.

const m = require('../../mainlines/feature.cjs');

const CC = 'webhook-intake';

function webhookIntake(h) {
  const log = `.workflows/${CC}/discovery/sessions/session-001.md`;
  h.write(log, [
    '# Discovery Session 001',
    '',
    'Date: 2026-01-01',
    `Work unit: ${CC}`,
    '',
    '## Description (as of session)',
    '',
    'One standard for every inbound provider webhook.',
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
    'Every service consumes provider webhooks its own way — some verify',
    'signatures and some do not, and a retried delivery can apply twice.',
    'Shaped as a cross-cutting concern: one intake standard every webhook',
    'consumer follows — verification, deduplication, prompt',
    'acknowledgement — rather than a fix to any one consumer.',
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
  h.engine('workunit', 'create', CC, 'cross-cutting',
    '--description', 'One standard for every inbound provider webhook',
    '--session-log-file', log);

  h.engine('topic', 'start', CC, 'discussion', CC);
  h.write(`.workflows/${CC}/discussion/${CC}.md`, [
    `# Discussion — ${CC}`,
    '',
    '## Context',
    '',
    'One intake standard for every inbound provider webhook: verification,',
    'deduplication, and acknowledgement.',
    '',
    '## Decisions',
    '',
    "- Every webhook is verified against the provider's signature before",
    '  its body is read; a failed verification is rejected with no side',
    '  effects.',
    "- Deliveries are deduplicated on the provider's event id — a repeat is",
    '  acknowledged and dropped.',
    '- Every webhook is acknowledged within two seconds; the work it',
    '  triggers runs after the acknowledgement.',
    '',
    '## Deferred',
    '',
    '- A shared intake library — revisit once two consumers follow the',
    '  standard.',
    '',
  ].join('\n'));
  h.engine('commit', CC, '-m', `discussion(${CC}): capture`);
  h.engine('topic', 'complete', CC, 'discussion', CC);

  h.engine('topic', 'start', CC, 'specification', CC);
  h.engine('manifest', 'set', `${CC}.specification.${CC}`, `sources.${CC}.status`, 'pending');
  h.write(`.workflows/${CC}/specification/${CC}/specification.md`, [
    '# Specification: Webhook Intake',
    '',
    '## Specification',
    '',
    '### 1. Verification',
    '',
    "- Every inbound webhook — a payment gateway's capture events included —",
    "  is verified against the provider's signature before its body is read.",
    '- A delivery that fails verification is rejected with no side effects.',
    '',
    '### 2. Deduplication',
    '',
    "- Deliveries are deduplicated on the provider's event id; a repeated",
    '  delivery is acknowledged and dropped.',
    '',
    '### 3. Acknowledgement',
    '',
    '- Every webhook is acknowledged within two seconds; the work a delivery',
    '  triggers, such as marking an order paid on capture, runs after the',
    '  acknowledgement.',
    '',
    '---',
    '',
    '## Working Notes',
    '',
  ].join('\n'));
  h.engine('manifest', 'set', `${CC}.specification.${CC}`, `sources.${CC}.status`, 'incorporated');
  h.engine('commit', CC, '-m', `spec(${CC}): construct`);
  h.engine('topic', 'complete', CC, 'specification', CC);
}

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.discuss(h);
    m.specify(h);
    webhookIntake(h);
    h.engine('manifest', 'set', 'project.defaults.plan_format', 'local-markdown');
  },
};

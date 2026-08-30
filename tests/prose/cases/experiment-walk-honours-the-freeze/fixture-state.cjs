'use strict';

// The `pay` feature, freshly created, shaped around one empirical doubt:
// the gateway's sandbox is suspected of delivering some webhooks twice,
// and whether idempotency handling is built now or deferred hangs on how
// often that actually happens. A day's sandbox export sits in the repo —
// the real thing the experiment measures.
//
// Deliberately built ONE line of its own: the mainline's create() carries
// a discussion-shaped Exploration, and this walk needs the measuring
// question in the carrier, so the log is authored here (same template
// shape, different content).

const f = require('../../mainlines/feature.cjs');

const WU = f.WU;

// 60 deliveries, three of them exact duplicates (evt-1007, evt-1021,
// evt-1033 appear twice). 5% — deterministic, countable with sort|uniq.
function webhookLog() {
  const lines = [];
  for (let i = 1; i <= 57; i++) {
    lines.push(`2026-01-01T10:${String(i).padStart(2, '0')}:00Z capture.confirmed evt-${1000 + i}`);
  }
  for (const dup of [7, 21, 33]) {
    lines.push(`2026-01-01T11:${String(dup).padStart(2, '0')}:00Z capture.confirmed evt-${1000 + dup}`);
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  build(h) {
    f.init(h);

    const log = `.workflows/${WU}/discovery/sessions/session-001.md`;
    h.write(log, [
      '# Discovery Session 001',
      '',
      'Date: 2026-01-01',
      `Work unit: ${WU}`,
      '',
      '## Description (as of session)',
      '',
      'Accept card payments at checkout.',
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
      'Shaped as a single feature: accept card payments at checkout using',
      'the existing gateway account. One doubt surfaced that talking',
      'cannot settle: the gateway sandbox is suspected of delivering some',
      'capture webhooks twice, and whether idempotent webhook handling is',
      'built for v1 or deferred hangs on how often that actually happens.',
      'A day of sandbox webhook deliveries is exported at',
      'logs/webhooks.log. Routed to experiment to measure it before the',
      'capture-flow discussion.',
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
    h.engine('workunit', 'create', WU, 'feature',
      '--description', 'Accept card payments at checkout',
      '--session-log-file', log);

    h.write('logs/webhooks.log', webhookLog());
  },
};

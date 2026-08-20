'use strict';

// A discussion one review cycle deep: review-001 went out with the map
// snapshot stamped at dispatch, came back clean, and was drained. The
// map has not moved since — one cycle puts the bar at one move, so the
// session that resumes here re-arms the moment it decides the open
// subtopic.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
      `# Discussion: Pay`,
      '',
      '## Context',
      '',
      'Accept card payments at checkout using the existing gateway',
      'account. Card-only for v1 — wallet support was deferred when the',
      'work was shaped.',
      '',
      '---',
      '',
      '## Capture Confirmation',
      '',
      '### Context',
      'How the checkout learns that a card payment was actually captured.',
      '',
      '### Journey',
      'Polling looked simplest until rate limits came up. The webhook is',
      'guaranteed by the provider, which settled it.',
      '',
      '### Decision',
      'Capture is confirmed by the gateway webhooks; the checkout never',
      'polls.',
      '',
      '---',
      '',
      '## Failed Payment Retries',
      '',
      '### Context',
      'What happens after a card payment fails — how many attempts, at',
      'what spacing, and when the counter resets.',
      '',
      '### Options Considered',
      '',
      '**Single attempt**',
      '- Pros: never hammers a declining card',
      '- Cons: punishes transient gateway blips',
      '',
      '**Bounded retries with backoff**',
      '- Pros: covers the transient case; bounded exposure',
      '- Cons: the bound and the backoff need pinning',
      '',
      '### Journey',
      'Leaning toward a small bounded number of attempts with backoff;',
      'the exact bound and reset condition are still open.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Failed-payment retries still exploring — bound and reset open.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));

    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');
    // A thread nobody reaches in the walk — the map must not converge
    // when the retry decision lands, or the walk would face the
    // concluding ceremony instead of the dispatch it pins.
    h.engine('discussion-map', 'add', WU, WU, 'chargeback-disputes');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'failed-payment-retries', 'exploring');

    // One completed cycle: dispatched over the settled map (snapshot
    // stamped), report landed, row drained. Nothing has moved since.
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, [
      '# Discussion Review',
      '',
      '## Summary',
      '',
      'Read fresh, the discussion holds a clear context and decided',
      'subtopics carrying their rationale. Coverage is thorough for the',
      'document\'s own scope.',
      '',
      '## Gaps Identified',
      '',
      'None identified.',
      '',
      '## Open Questions',
      '',
      'None identified.',
      '',
      'STATUS: clean',
      'GAPS_COUNT: 0',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: Coverage is thorough; no gaps or open questions.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--clean');

    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): document capture confirmation, retries exploration`);
  },
};

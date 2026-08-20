'use strict';

// A discussion three review cycles deep: every dispatch took the real
// arming gate at build time (map movement between cycles), so each row
// carries its dispatch-time map snapshot and the store's latest
// snapshot equals the current map exactly. One subtopic is still
// exploring — the session that resumes here will decide it, and one
// move against a three-cycle backoff (needs 3) must leave the dispatch
// check quiet.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

const REVIEW_REPORT = [
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
].join('\n');

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
      '## Card Data Handling',
      '',
      '### Context',
      'Whether card details ever touch our own servers.',
      '',
      '### Journey',
      'PCI scope drove this: the gateway\'s hosted fields keep the pan',
      'and cvc on the gateway\'s side entirely, so our servers only ever',
      'see a token.',
      '',
      '### Decision',
      'The gateway\'s hosted fields — card details never touch our',
      'servers.',
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
      '- Card data decided — hosted fields, nothing touches our servers.',
      '- Failed-payment retries still exploring — bound and reset open.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));

    // Three completed review cycles, each dispatch through the real
    // arming gate: the first is free, the second arms on one move
    // (capture decided), the third on two (card decided + retries
    // advanced). Every row carries its dispatch-time map snapshot; the
    // latest equals the map the walk resumes over.
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'card-data-handling');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');

    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, REVIEW_REPORT);
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--clean');

    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-002.md`, REVIEW_REPORT);
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-002', '--clean');

    h.engine('discussion-map', 'set', WU, WU, 'card-data-handling', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'failed-payment-retries', 'exploring');
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-003.md`, REVIEW_REPORT);
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-003', '--clean');

    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): document capture, card handling, retries exploration`);
  },
};

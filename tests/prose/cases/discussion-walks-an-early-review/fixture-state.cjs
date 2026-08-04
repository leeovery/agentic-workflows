'use strict';

// A discussion barely begun — one subtopic exploring, three pending,
// nothing decided — whose background review returned early-maturity
// findings: fuel, both walked, no batch lanes. The store row is
// acknowledged and announced, nothing surfaced — the walk opens on the
// announce menu and must produce no batch screens.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
      '# Discussion: Pay',
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
      '### Options Considered',
      '',
      '**Poll the gateway**',
      '- Pros: simple, no inbound endpoint needed',
      '- Cons: slow to confirm under load',
      '',
      '**Gateway webhooks**',
      '- Pros: guaranteed delivery, near-immediate confirmation',
      '- Cons: needs a verified inbound endpoint',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation exploring — two options on the table,',
      '  nothing decided.',
      '- Currency handling, failed-payment retries, card-data handling',
      '  identified but untouched.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'currency-handling');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');
    h.engine('discussion-map', 'add', WU, WU, 'card-data-handling');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'exploring');
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): capture options on the table`);

    // The store driven through its real lifecycle: dispatch allocates the
    // row in-flight, the report lands on disk, scan promotes it to pending,
    // ack records the findings. Announced, nothing surfaced.
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, [
      '# Discussion Review — review-001',
      '',
      '## Summary',
      '',
      'A young document — one subtopic exploring, nothing decided. Both',
      'findings are ground worth pulling toward, not defects in what',
      'little is written.',
      '',
      '## Gaps Identified',
      '',
      '### F1: Failure UX is untouched ground worth pulling before retries',
      '',
      '**Lane:** decide',
      '',
      'What the shopper sees when a payment fails — retry messaging,',
      'decline reasons, whether the basket survives — has not come up.',
      'It borders both capture confirmation and the untouched retries',
      'subtopic, and deciding retries first would bake in answers to',
      'questions nobody has asked yet. An area to open, not a defect.',
      '',
      '### F2: The gateway idempotency guarantees are adjacent ground worth a look',
      '',
      '**Lane:** decide',
      '',
      'Double-submit at checkout — two clicks, one charge? — turns on the',
      "gateway's idempotency behaviour, which no option under capture",
      'confirmation examines. Worth a look while options are still open;',
      'the webhook choice reads differently if idempotency keys are',
      'already required.',
      '',
      '## Observations',
      '',
      '- The Options blocks are thin on failure modes, but the subtopic is',
      '  exploring and the conversation will get there — not raised.',
      '',
      'STATUS: gaps_found',
      'FINDINGS: F1,F2',
      'GAPS_COUNT: 2',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: Two areas worth opening — failure UX and gateway idempotency; nothing in the young document is wrong.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--findings', 'F1,F2');
    h.engine('agent', 'announce', WU, 'discussion', WU, 'review-001');
  },
};

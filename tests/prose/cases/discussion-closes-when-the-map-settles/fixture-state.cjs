'use strict';

// A discussion one decision short of settled: four subtopics decided and
// written, a fifth — what the shopper sees when the gateway declines a
// card — opened in the last sitting and left `exploring`, undocumented.
// Two background reviews have run: the first returned two findings the
// user walked through (the retry cap pinned, the missed-webhook sweep
// added), the second came back clean once the map had moved on and was
// acknowledged as such — so the store holds two report-backed cycles,
// and the arming anchor's snapshot already carries the open subtopic as
// `exploring`. One decided write moves the map by exactly one, and two
// cycles need two: the write that settles the map arms nothing. The
// discussion file's only commit is the first review's drain engagement,
// layered as world history so it carries its drain marker.

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
      '### Options Considered',
      '',
      '**Poll the gateway**',
      '- Pros: simple, no inbound endpoint needed',
      '- Cons: slow to confirm, hammers the gateway under load',
      '',
      '**Gateway webhooks**',
      '- Pros: guaranteed delivery, near-immediate confirmation',
      '- Cons: needs a verified inbound endpoint',
      '',
      '### Journey',
      'Polling looked simplest until rate limits came up — confirming a',
      'burst of checkouts by polling would either lag or hammer the',
      'gateway. The webhook is guaranteed by the provider, which settled',
      'it.',
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
      'The conversation leaned on "a small bounded number of attempts"',
      'without pinning it; the background review flagged the gap.',
      '',
      '### Journey',
      'Unbounded retries risk hammering a declining card; a single',
      'attempt punishes transient gateway blips. Three attempts with',
      'exponential backoff covers the transient case without re-running',
      'a hard decline all day.',
      '',
      '### Decision',
      'Three attempts per payment, exponential backoff, counter resets',
      'only on a new checkout.',
      '',
      '---',
      '',
      '## Webhook Reconciliation',
      '',
      '### Context',
      'Capture confirmation is webhook-only, and the background review',
      'flagged that nothing covered a webhook that never arrives.',
      '',
      '### Journey',
      'A gateway outage or rejected delivery would strand the order',
      'pending forever with the polling path ruled out. A targeted sweep',
      'is not polling: it only queries orders already stuck past a',
      'threshold.',
      '',
      '### Decision',
      'An hourly reconciliation sweep queries the gateway for orders',
      'pending longer than 30 minutes and settles them from the',
      'authoritative payment state.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Card data decided — hosted fields, nothing touches our servers.',
      '- Failed-payment retries decided — three attempts, exponential backoff.',
      '- Webhook reconciliation decided — hourly sweep for stuck orders.',
      '- Declined-card messaging still open — what the shopper sees when',
      '  the gateway declines the card was raised but not settled.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');
    h.engine('discussion-map', 'add', WU, WU, 'card-data-handling');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'card-data-handling', 'decided');

    // The first review, driven through its real lifecycle — order
    // matters: dispatch allocates review-001 in-flight, the report
    // lands on disk, scan promotes it to pending, ack records the
    // findings, announce marks the user told, and surfacing F1 then F2
    // drains the row — raising the last finding incorporates it
    // automatically.
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, [
      '# Discussion Review',
      '',
      '## Summary',
      '',
      'The decided ground is well documented, but the decision it rests',
      'on carries an unexamined failure path, and an asserted bound is',
      'never pinned.',
      '',
      '## Gaps Identified',
      '',
      '### F1: Retry cap asserted but never pinned',
      '',
      'The Summary holds failed-payment retries as open while the',
      'conversation leans on "a small bounded number of attempts" — but',
      'no bound, backoff, or reset condition is recorded anywhere. If',
      'the discussion closes without pinning the number, planning will',
      'have to invent one.',
      '',
      '### F2: Webhook capture has no missed-webhook path',
      '',
      'The Capture Confirmation decision rests on the gateway webhook',
      'being guaranteed, and polling is explicitly ruled out. Nothing',
      'records what happens when the webhook never arrives — a gateway',
      'outage or a rejected delivery leaves the order pending forever,',
      'and with polling off the table there is no documented',
      'reconciliation path.',
      '',
      'STATUS: gaps_found',
      'FINDINGS: F1,F2',
      'GAPS_COUNT: 2',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: Two gaps — an unpinned retry bound, and no path for a webhook that never arrives.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--findings', 'F1,F2');
    h.engine('agent', 'announce', WU, 'discussion', WU, 'review-001');
    h.engine('agent', 'surface', WU, 'discussion', WU, 'review-001', 'F1');
    h.engine('discussion-map', 'set', WU, WU, 'failed-payment-retries', 'decided');
    h.engine('agent', 'surface', WU, 'discussion', WU, 'review-001', 'F2');
    h.engine('discussion-map', 'add', WU, WU, 'webhook-reconciliation');
    h.engine('discussion-map', 'set', WU, WU, 'webhook-reconciliation', 'decided');

    // The last sitting opened one more thread and left it live.
    h.engine('discussion-map', 'add', WU, WU, 'declined-card-messaging');
    h.engine('discussion-map', 'set', WU, WU, 'declined-card-messaging', 'exploring');

    // The second review: armed on the map's movement since the first
    // (three moves against one needed), dispatched over the map as it
    // stands — its snapshot holds the open thread as `exploring` — and
    // returned clean, so the ack incorporates it in one call. Two
    // report-backed cycles now stand in the store.
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-002.md`, [
      '# Discussion Review',
      '',
      '## Summary',
      '',
      'Read fresh, the discussion holds a clear context and subtopics that',
      'each carry a decision with its rationale — alternatives explored and',
      'trade-offs acknowledged. Coverage is thorough for the document\'s own',
      'scope.',
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
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-002', '--clean');

    // The engagement write, committed with its drain marker — the
    // discussion file's single commit (one commit per file is a
    // harness limit), declared as world history so the materialised
    // world's git log carries it.
    h.write('.world-history.json', JSON.stringify([
      { message: `discussion(${WU}/${WU}): decided webhook reconciliation (review-001 F2)`,
        files: [`.workflows/${WU}/discussion/${WU}.md`] },
    ], null, 2));
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): decided webhook reconciliation (review-001 F2)`);
  },
};

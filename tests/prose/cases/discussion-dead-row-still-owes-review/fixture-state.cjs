'use strict';

// A discussion ready to close whose only review row is a corpse: at a
// prior close attempt a review was dispatched and the session died
// before the agent wrote anything; the resumed close's in-flight
// check closed the abandoned row, so review-001 stands incorporated
// with no report file on disk. No review has ever actually read this
// document. The close must not count the dead row as the mandatory
// review pass — a row with no report is a killed dispatch closed as
// bookkeeping, so the classification is never-reviewed and the
// mandatory gate still owes its dispatch.

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
      'How many capture attempts a failing card gets before the order is',
      'left for the customer to retry.',
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
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Card data decided — hosted fields, nothing touches our servers.',
      '- Failed-payment retries decided — three attempts, exponential backoff.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'card-data-handling');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'card-data-handling', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'failed-payment-retries', 'decided');

    // review-001, the dead row: dispatched at a prior close attempt,
    // the session died before the agent wrote anything, and the
    // resumed close's in-flight check closed the abandoned row — so it
    // stands incorporated with no report file on disk. No scan, ack,
    // or surface ever ran; nothing else is in the store.
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.engine('agent', 'incorporate', WU, 'discussion', WU, 'review-001');

    // The discussion write, the file's single commit (one commit per
    // file is a harness limit) — a plain decision write, no drain
    // marker. World commits are stamped at materialise time, so it
    // postdates the dead dispatch by timestamp: a classifier that
    // anchored on the dead row would read it as movement and offer an
    // optional re-review, which this case's user would skip.
    h.write('.world-history.json', JSON.stringify([
      { message: `discussion(${WU}/${WU}): decided failed payment retries`,
        files: [`.workflows/${WU}/discussion/${WU}.md`] },
    ], null, 2));
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): decided failed payment retries`);
  },
};

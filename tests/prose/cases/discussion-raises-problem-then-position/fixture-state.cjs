'use strict';

// A discussion mid-flight — two subtopics decided, one exploring, one
// pending — whose background review returned two walked findings. The
// first carries a rich report section: a worked trace, per-option
// costs, and secondary consequences. The behaviour under test is that
// the raise opens the problem and a position and holds that depth
// back. The store row is acknowledged and announced, nothing surfaced
// — the walk opens on the announce menu and must produce no batch
// screens.

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
      '### Decision',
      '',
      'Gateway webhooks confirm capture; the checkout never polls. The',
      'webhook consumer marks the order paid, and duplicate deliveries',
      'are idempotent.',
      '',
      '---',
      '',
      '## Currency Handling',
      '',
      '### Context',
      'Which currencies checkout accepts and how amounts are carried.',
      '',
      '### Decision',
      '',
      'GBP only for v1. Amounts are integer minor units end to end;',
      'no conversion anywhere in the flow.',
      '',
      '---',
      '',
      '## Failed-Payment Retries',
      '',
      '### Context',
      'What happens after a card is declined — whether and how the',
      'shopper can try again within the same checkout.',
      '',
      '### Options Considered',
      '',
      '**Inline retry** — the shopper corrects the card details and',
      'resubmits without leaving the payment step.',
      '',
      '**Restart checkout** — a decline ends the attempt; the shopper',
      'starts over from the basket.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Currency handling decided — GBP only, integer minor units.',
      '- Failed-payment retries exploring — two options on the table.',
      '- Card-data handling identified but untouched.',
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
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'currency-handling', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'failed-payment-retries', 'exploring');
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): capture and currency decided, retries open`);

    // The store driven through its real lifecycle: dispatch allocates the
    // row in-flight, the report lands on disk, scan promotes it to pending,
    // ack records the findings. Announced, nothing surfaced.
    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, [
      '# Discussion Review — review-001',
      '',
      '## Summary',
      '',
      'A forming document — two subtopics decided, retries exploring.',
      'Both findings are open choices this topic owns; neither is',
      'settled by anything on the page.',
      '',
      '## Gaps Identified',
      '',
      '### F1: A retry has no payment-intent story, and the capture decision makes that dangerous',
      '',
      '**Lane:** ask',
      '',
      'Both retry options assume "the shopper pays again", but nothing',
      'says what a second attempt does with the payment intent: reuse',
      'the intent the first attempt opened, or mint a fresh one. The',
      'decided capture ground is what makes the gap sharp. Trace it:',
      'attempt one submits, the gateway declines, the shopper retries,',
      'and the first attempt’s capture webhook is still in flight when',
      'the second attempt submits. With a fresh intent per attempt the',
      'order now has two live intents and the webhook consumer marks it',
      'paid whichever lands — a double-charge window the capture',
      'decision never contemplated, since it assumes one intent per',
      'order. Reuse has its own costs: the gateway’s idempotent-retry',
      'semantics need confirming, and an intent can expire between',
      'attempts, which turns a retry into a failure with no path back.',
      'A fresh-intent rule also leaves orphaned intents behind every',
      'decline — reconciliation has to sweep them or reporting',
      'over-counts open payments — and the refund path sketched under',
      'capture confirmation assumes exactly one intent per order, so a',
      'multi-intent order breaks refunds too. The document decides',
      'neither way; the choice is structural and this topic owns it.',
      '',
      '### F2: The retry ceiling is unstated',
      '',
      '**Lane:** ask',
      '',
      'Neither option says how many declines end the conversation —',
      'whether the checkout caps attempts at all, and at what number.',
      'The gateway account’s own velocity rules would make the product',
      'answer moot if they are stricter; the account’s configured',
      'limits are not in the document.',
      '',
      '## Observations',
      '',
      '- The Options blocks under retries are thin on messaging copy;',
      '  the conversation will get there — not raised.',
      '',
      'STATUS: gaps_found',
      'FINDINGS: F1,F2',
      'GAPS_COUNT: 2',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: Two open choices under retries — the payment-intent story and the attempt ceiling; the capture decision makes the first structural.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--findings', 'F1,F2');
    h.engine('agent', 'announce', WU, 'discussion', WU, 'review-001');
  },
};

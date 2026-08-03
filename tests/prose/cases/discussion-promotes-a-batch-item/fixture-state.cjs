'use strict';

// A review that came back entirely in the apply lane, one item of which
// is not actually settled: the reviewer read a Journey sentence as
// deciding something the Journey only reported. The batch screen offers
// all three; the user's answer promotes the middle one out.

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
      '### Journey',
      'Polling looked simplest until rate limits came up. The webhook is',
      'guaranteed by the provider, which settled it. An earlier draft',
      'argued for a polling fallback on top of the webhook; that was',
      'dropped once delivery guarantees were confirmed. Someone raised',
      'reconciling a webhook that never arrives at all — we noted it and',
      'moved on without settling it.',
      '',
      '### Decision',
      'Capture is confirmed by the gateway webhooks; the checkout never',
      'polls. A polling fallback remains available if delivery proves',
      'unreliable.',
      '',
      '---',
      '',
      '## Currency Handling',
      '',
      '### Context',
      'What currencies a checkout may quote and capture in.',
      '',
      '### Decision',
      'Amounts are minor units, integer only, never floats. The gateway',
      'is called with the store currency.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Currency handling decided — integer minor units.',
      '',
      '### Open Threads',
      '- Reconciling a webhook that never arrives was raised and not settled.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'currency-handling');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'currency-handling', 'decided');
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): capture and currency decided`);

    h.engine('agent', 'dispatch', WU, 'discussion', WU, '--kind', 'review');
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/review-001.md`, [
      '# Discussion Review — review-001',
      '',
      '## Summary',
      '',
      'Three corrections, each determined by a decision the document',
      'already carries.',
      '',
      '## Gaps Identified',
      '',
      '### F1: The Decision keeps a polling fallback the Journey retired',
      '',
      '**Lane:** apply',
      '',
      'Capture Confirmation § Journey records that the polling fallback was',
      'dropped once delivery guarantees were confirmed. The Decision beneath',
      'it still ends "A polling fallback remains available if delivery',
      'proves unreliable." Strike it.',
      '',
      '### F2: The missed-webhook path is decided but never written down',
      '',
      '**Lane:** apply',
      '',
      'The Journey records that reconciling a webhook that never arrives was',
      'raised. Since polling is ruled out, the reconciliation path follows:',
      'the checkout reconciles pending orders against the gateway on a',
      'schedule. State it in the Decision.',
      '',
      '### F3: The currency rule is stated for amounts but left implied for refunds',
      '',
      '**Lane:** apply',
      '',
      'Currency Handling decides integer minor units, never floats, and',
      'names the store currency. Refunds are an amount by the same rule and',
      'the section never says so.',
      '',
      'STATUS: gaps_found',
      'FINDINGS: F1,F2,F3',
      'GAPS_COUNT: 3',
      'QUESTIONS_COUNT: 0',
      'SUMMARY: Three corrections determined by decisions already recorded.',
      '',
    ].join('\n'));
    h.engine('agent', 'scan', WU, 'discussion', WU);
    h.engine('agent', 'ack', WU, 'discussion', WU, 'review-001', '--findings', 'F1,F2,F3');
    h.engine('agent', 'announce', WU, 'discussion', WU, 'review-001');
  },
};

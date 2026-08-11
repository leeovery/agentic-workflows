'use strict';

// A discussion whose previous sitting made two derivable calls mid-thread
// and queued them — then died before reaching a natural break. No agent
// rows exist. The queue file is the only trace: this session must find
// it on resume and flush it through the decide screen.

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
      'guaranteed by the provider — every event arrives signed and carries',
      'a provider event id — which settled it.',
      '',
      '### Decision',
      'Capture is confirmed by the gateway webhooks; the checkout never',
      'polls.',
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
      'is called with the store currency, and each capture records the',
      'currency it was taken in.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Currency handling decided — integer minor units.',
      '- Failed-payment retries still open.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'currency-handling');
    h.engine('discussion-map', 'add', WU, WU, 'failed-payment-retries');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'currency-handling', 'decided');
    h.engine('commit', WU, '-m', `discussion(${WU}/${WU}): capture and currency decided`);

    // The prior sitting's queued calls — cache-resident, never committed.
    h.write(`.workflows/.cache/${WU}/discussion/${WU}/calls-queue.json`, JSON.stringify({
      items: [
        {
          title: 'Webhook payloads are verified with the gateway signing secret',
          detail: 'Webhooks are the sole confirmation channel, so an unverified endpoint accepts a forged capture. Determined by the Capture Confirmation decision and gateway convention — every event arrives signed. No subtopic on the map owns endpoint hardening.',
        },
        {
          title: 'A refund is issued in the currency of its original capture',
          detail: 'Refund flow never came up, and re-quoting would need a conversion path integer minor units do not have. Determined by the Currency Handling decision — each capture records its currency — and gateway convention. No subtopic on the map owns refunds.',
        },
      ],
      pulled: [],
    }, null, 2));
  },
};

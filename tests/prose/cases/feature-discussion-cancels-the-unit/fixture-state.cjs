'use strict';

// The `pay` feature shaped in discovery and one sitting into its
// discussion: two subtopics on the map, one decided and written up, one
// still being explored. A feature's topic is its work unit, so what sits
// under the name is the whole unit — there is no map row above it and no
// sibling topic beside it.

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
      '## Summary',
      '',
      '### Current State',
      '- Capture confirmation decided — webhooks, never polling.',
      '- Declined-card messaging still open — what the shopper sees when',
      '  the gateway declines the card was raised but not settled.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, WU, 'capture-confirmation');
    h.engine('discussion-map', 'add', WU, WU, 'declined-card-messaging');
    h.engine('discussion-map', 'set', WU, WU, 'capture-confirmation', 'decided');
    h.engine('discussion-map', 'set', WU, WU, 'declined-card-messaging', 'exploring');
    h.engine('commit', WU, '--topic', `discussion/${WU}`, '-m',
      `discussion(${WU}/${WU}): decided capture confirmation`);
  },
};

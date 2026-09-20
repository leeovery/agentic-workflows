'use strict';

// The plan is authored and graphed; review and conclusion have not run,
// and every gate mode reads `gated`. The discussion is written in the
// template's own subtopic shape, so a decision landed into it at the
// review has an idiom to land in, and the specification is its
// extraction.
//
// The traceability review's stub stages two findings against this
// world: one the specification settles outright, and one that indicts
// the specification — it asserts card-only and never says what the
// shopper who arrives with a wallet method actually meets, which is a
// product fork the record does not settle.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

// The concluded discussion, in the template's subtopic shape — one
// decided subtopic and a summary. Nothing here decides what a shopper
// with a non-card method meets at checkout.
const DISCUSSION = [
  '# Discussion: Pay',
  '',
  '## Context',
  '',
  'Accept card payments at checkout using the existing gateway account.',
  '',
  '---',
  '',
  '## Gateway Integration',
  '',
  '### Context',
  'Which account the checkout uses, and how a capture is confirmed.',
  '',
  '### Options Considered',
  '',
  '**Poll the gateway from the checkout**',
  '- Pros: the checkout can answer the shopper on the spot.',
  '- Cons: it answers with a guess whenever the gateway is slow.',
  '',
  '**Wait for the gateway to tell us**',
  "- Pros: the answer is the gateway's own, and it is repeated if the",
  '  first attempt fails.',
  '- Cons: it arrives after the checkout has handed the shopper on.',
  '',
  '### Journey',
  'The existing account carries the rates we already have, so a new',
  'provider was never seriously on the table. Confirmation was the real',
  'question. Polling looked attractive until we followed a slow gateway',
  'through it: the checkout would have to answer the shopper with a',
  'guess, and a wrong guess about money is worse than a slower answer.',
  'We settled on webhooks — the gateway tells us, and it tells us again',
  'if the first attempt fails. Card-only for v1 was agreed in passing:',
  'wallets wait until the card path is proven.',
  '',
  '### Decision',
  'Use the existing gateway account — no new provider onboarding.',
  'Capture is confirmed by gateway webhook; the checkout never polls.',
  'Card only for v1; wallet support is deferred.',
  '',
  '---',
  '',
  '## Summary',
  '',
  '### Key Insights',
  '1. Confirmation is asynchronous by design: the checkout hands the',
  '   shopper to the gateway and hears back afterwards, and nothing in',
  '   the flow waits on a poll.',
  '',
  '### Open Threads',
  '- (none)',
  '',
  '### Current State',
  '- Gateway integration is resolved.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, DISCUSSION);
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);

    m.specify(h);
    m.planAuthored(h);
    m.planGraphed(h);
  },
};

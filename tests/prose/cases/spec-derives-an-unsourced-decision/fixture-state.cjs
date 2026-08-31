'use strict';

// A specification at the review boundary carrying a value its source
// never states: each gateway attempt capped at 2 seconds, while the
// discussion decides only the shape around the cap — one retry fired
// immediately with no backoff, the whole sequence inside the
// checkout's 6-second interstitial budget, the cap there so a hung
// call never eats the retry's chance and no tighter than the budget
// forces. That recorded rationale pins the cap mechanically (two
// equal attempts inside 6 seconds → 3 seconds each), so the
// unsourced-decision route's derivation must run IN: input review
// flags the value, the orchestrator routes it, the derivation settles
// it with a one-line notify — no stop — the discussion gains the
// decision it never made as a new subtopic section, and the spec
// re-aligns to what the record now says.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The completed discussion — the resilience shape decided through,
    // the per-attempt cap's value never stated.
    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
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
      'Which account and confirmation path the checkout uses.',
      '',
      '### Decision',
      'Use the existing gateway account — no new provider onboarding.',
      'Capture is confirmed by gateway webhooks; the checkout never polls.',
      '',
      '---',
      '',
      '## Intent Creation Resilience',
      '',
      '### Context',
      'What checkout does when the gateway call that creates the payment',
      'intent fails or hangs.',
      '',
      '### Options Considered',
      '',
      '**Fail on the first error**',
      '- Pros: simplest; fastest worst case',
      '- Cons: a transient network blip kills a valid checkout',
      '',
      '**Retry until the interstitial**',
      '- Pros: maximum recovery',
      '- Cons: unbounded attempts pile onto a struggling gateway',
      '',
      '**One retry inside the budget**',
      '- Pros: covers the transient case without piling on',
      '- Cons: a genuinely down gateway still costs the full budget',
      '',
      '### Journey',
      "We anchored on the checkout's interstitial: at 6 seconds the",
      'checkout stops waiting and shows the retry screen, so gateway work',
      'past that point is wasted. One retry covers the transient-blip',
      'case, and it fires immediately — there is no backoff to spend',
      'budget on. That forces a per-attempt cap: a hung first attempt',
      "must never eat the retry's chance. Nothing distinguishes the",
      'attempts — the retry is the same call again — so neither deserves',
      'more room than the other, and the cap should sit no tighter than',
      'the budget forces: a slow-but-succeeding call beats a premature',
      'retry.',
      '',
      '### Decision',
      'One retry on a transient network error — two attempts total, the',
      'retry fired immediately, no backoff. The whole attempt sequence',
      "resolves inside the checkout's 6-second interstitial budget, and",
      "each attempt is capped so a hung call never eats the retry's",
      'chance — the cap no tighter than the budget forces.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      "1. The interstitial's 6-second threshold is the whole resilience",
      '   budget — every retry decision divides it, none extends it.',
      '',
      '### Open Threads',
      '- (none)',
      '',
      '### Current State',
      '- Gateway integration and intent-creation resilience are both',
      '  resolved.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);

    // Construction done in an earlier sitting: the spec carries the
    // discussion faithfully — plus a cap value nobody decided. Review
    // has not begun.
    h.engine('topic', 'start', WU, 'specification', WU);
    h.engine('manifest', 'set', `${WU}.specification.${WU}`,
      `sources.${WU}.status=pending`,
      'review_cycle=0',
      'finding_gate_mode=gated',
      'construction_gate_mode=gated',
      'date=2026-01-01');
    h.write(`.workflows/${WU}/specification/${WU}/specification.md`, [
      '# Specification: Pay',
      '',
      '## Specification',
      '',
      '### Gateway Integration',
      '',
      '- Checkout creates payment intents against the existing gateway',
      '  account; card payments only.',
      '- Capture is confirmed by gateway webhook, never by polling.',
      '',
      '### Intent Creation Resilience',
      '',
      '- Intent creation is attempted at most twice: one retry on a',
      '  transient network error, fired immediately — no backoff.',
      "- The whole attempt sequence resolves inside the checkout's",
      '  6-second interstitial budget.',
      '- Each gateway attempt is capped at 2 seconds.',
      '',
      '---',
      '',
      '## Working Notes',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', `${WU}.specification.${WU}`, `sources.${WU}.status`, 'incorporated');
    h.engine('commit', WU, '-m', `spec(${WU}): construct`);
  },
};

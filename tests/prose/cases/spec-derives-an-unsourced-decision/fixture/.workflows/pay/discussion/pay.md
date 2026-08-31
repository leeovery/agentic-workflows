# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway account.

---

## Gateway Integration

### Context
Which account and confirmation path the checkout uses.

### Decision
Use the existing gateway account — no new provider onboarding.
Capture is confirmed by gateway webhooks; the checkout never polls.

---

## Intent Creation Resilience

### Context
What checkout does when the gateway call that creates the payment
intent fails or hangs.

### Options Considered

**Fail on the first error**
- Pros: simplest; fastest worst case
- Cons: a transient network blip kills a valid checkout

**Retry until the interstitial**
- Pros: maximum recovery
- Cons: unbounded attempts pile onto a struggling gateway

**One retry inside the budget**
- Pros: covers the transient case without piling on
- Cons: a genuinely down gateway still costs the full budget

### Journey
We anchored on the checkout's interstitial: at 6 seconds the
checkout stops waiting and shows the retry screen, so gateway work
past that point is wasted. One retry covers the transient-blip
case, and it fires immediately — there is no backoff to spend
budget on. That forces a per-attempt cap: a hung first attempt
must never eat the retry's chance. Nothing distinguishes the
attempts — the retry is the same call again — so neither deserves
more room than the other, and the cap should sit no tighter than
the budget forces: a slow-but-succeeding call beats a premature
retry.

### Decision
One retry on a transient network error — two attempts total, the
retry fired immediately, no backoff. The whole attempt sequence
resolves inside the checkout's 6-second interstitial budget, and
each attempt is capped so a hung call never eats the retry's
chance — the cap no tighter than the budget forces.

---

## Summary

### Key Insights
1. The interstitial's 6-second threshold is the whole resilience
   budget — every retry decision divides it, none extends it.

### Open Threads
- (none)

### Current State
- Gateway integration and intent-creation resilience are both
  resolved.

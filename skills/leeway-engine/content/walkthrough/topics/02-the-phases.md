# The phases

A piece of work moves through phases, and each builds on what the last one recorded. The phases group into three stages: explore and decide, specify, build and verify.

```
   ── DISCOVERY ──── explore and decide ─────────────────
      discovery      settles what the work is
      discussion     argues the design through to conclusions
      experiment     measures a number a decision rests on
      investigation  finds the root cause of a bug

   ── DEFINITION ─── specify ────────────────────────────
      specification  the contract, cut into phases

   ── DELIVERY ───── build and verify ───────────────────
      implementation builds the tasks, tests first
      review         holds the result against the spec
```

Every kind of work begins in discovery. A feature and an epic's topics take discussion; a bugfix takes investigation instead; both then go through specification, implementation and review. A quick-fix goes from discovery straight to its fixes, and has a review only if you ask for one when it closes. An experiment is never a phase you enter on purpose: a discussion spawns one when a decision is about to rest on a number nobody has measured, and its result comes back to the conversation that asked.

The stage tells you how much a phase will ask of you. Discovery-stage phases are conversations. The specification is for you to approve: ready to build shows its outline and its cut into phases on one screen. Delivery runs largely on its own, the build stopping only for what needs you. The card *Gates, auto and step* covers the stops themselves.

What the build works from is the specification, and every statement in it traces back to a decision on the record.

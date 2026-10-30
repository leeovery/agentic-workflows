# The phases

A piece of work moves through phases, and each phase writes a document into your repository that you read and approve before the next phase builds on it. The phases group into three stages, which are also the three bands of an epic's dashboard.

```
   ── DISCOVERY ──── explore and decide ──────────────────────
      discovery      settles what the work is, and how big
      research       explores the ground: feasibility, options
      experiment     measures a number a decision rests on
      discussion     argues the design through to conclusions
      investigation  finds the root cause of a bug

   ── DEFINITION ─── specify and plan ───────────────────────
      scoping        a quick-fix's context, spec and plan in one
      specification  the contract everything is built from
      planning       phases, tasks and the order to build them

   ── DELIVERY ───── build and verify ───────────────────────
      implementation builds the tasks one at a time, tests first
      review         holds the result against the specification
```

Every kind of work begins in discovery and ends in review, apart from a cross-cutting concern, which finishes at its specification. Which of the middle phases a piece of work visits depends on its kind: a feature and an epic's topic take research (when there's ground to survey) and discussion; a bugfix takes investigation instead; a quick-fix collapses the middle into scoping. An experiment is never a phase you enter on purpose. It is offered from inside research or discussion when a decision is about to rest on a number nobody has actually measured, and its result feeds back into the conversation that asked.

The stage a phase belongs to tells you how much it will ask of you. Discovery-stage phases are conversations and stop often; Definition-stage phases produce documents for you to approve; Delivery-stage phases run largely on their own and stop only for a genuine decision. The card *Gates and auto* covers the stops themselves.

The specification is the one document with a special status. It is the record of validated decisions, it never fades from the knowledge base, and it is the only document corrected after the fact when later work proves a claim wrong.

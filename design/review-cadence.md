# Review Cadence — how often a review runs, not how much it returns

The lanes programme cut what a review *returns*: a bar on what is worth
raising, and a presentation that matches the ceremony to the move owed.
It left untouched how often a review *runs*. Both terms multiply, and
the second is now the larger one. Design log for the work that damps it.
Opened 2026-08-04.

## Motivation (2026-08-04)

- **The measurement the lanes work was opened on was a product of two
  numbers.** fumi: 12 discovery topics, three in progress, zero decided,
  **17 review rounds** across those three. Lanes addressed findings per
  round. Rounds per topic is the other factor and is unchanged.

- **A walk caught the cadence in the act.** During the lane sweep,
  `discussion-wraps-when-all-decided` recorded two review dispatches
  across three commits — review-002 created roughly two and a half
  minutes after review-001 drained clean — and the closing gate then
  offered a third off a single meaningful commit. The asserter flagged
  it unprompted: *"worth a human's eye on the trigger checklist's
  cadence."*

- **The trigger is looser than it reads.** `review-agent.md`'s checklist
  gates on four conditions: meaningful content committed, all prior
  reviews drained, not the first commit, and 2–3 conversational
  exchanges since the last dispatch. Every one of those clears again
  the moment a review finishes and one more decision lands. Nothing in
  the checklist is a function of how many reviews the topic has already
  had.

- **The self-healing property cuts both ways.** The drained-review block
  is deliberately self-healing — the next meaningful commit re-fires the
  trigger, so no dispatch is ever lost. That is correct for a topic on
  its first review and wrong for a topic on its sixth: the same
  mechanism that guarantees coverage early guarantees churn late.

- **The signal already exists and nothing reads it.**
  `discussion-process/scripts/gateway.cjs:81` computes `review_cycles`
  per topic and publishes it in the map call's DATA section.
  `discussion-session.md:114` names it in the list of what DATA carries.
  No prose anywhere branches on it. It has been a dead signal since it
  was added.

## The shape of the fix

- **R1 — cadence is a property of the topic, not of the last commit.**
  Every condition in the current trigger is local to the most recent
  write. None of them can express "this topic has been reviewed enough".
  The count has to enter the decision.

- **R2 — automatic dispatch has a ceiling; review above it is
  request-only.** Past N cycles on a topic the trigger stops firing on
  its own. The user can still ask for a review, and the mandatory
  final-review pass before conclusion is unaffected — what stops is the
  self-arming loop.

- **R3 — "meaningful content" stays necessary, stops being
  sufficient.** The test is doing real work: it is what excludes drain
  commits and deferral bookkeeping. It just cannot see history.

- **R4 — the ceiling is visible, never silent.** A topic that has
  stopped auto-reviewing says so where the user would otherwise expect a
  review, rather than quietly ceasing. A cadence rule the user cannot
  see reads as the system forgetting.

## Open decisions

- **What N is.** fumi reached six on one topic. Three feels defensible
  and is untested. This wants at least one real epic's worth of evidence
  before it is pinned.

- **Whether the ceiling resets.** A topic reopened by a triage landing
  has genuinely new ground; a topic the user simply keeps editing does
  not. If it resets, on what — a reopen, a phase transition, nothing?

- **Whether the count is per topic or per work unit.** `review_cycles`
  is computed per topic today. An epic where every topic independently
  reaches the ceiling still runs many reviews.

- **Whether the closing gate is in scope.** `closing-gates.md` offers a
  fresh review at conclusion when the discussion has moved since the
  last one. That is the offer the walk saw fire off a single commit. It
  may want the same ceiling, or it may be the deliberate exception —
  conclusion is the one moment a stale review genuinely costs something
  downstream.

## Relationship to the lanes programme

Lanes changed presentation and classification; they did not touch
dispatch. The two are independent and compose: a lower cadence with the
bar in place means fewer rounds each returning less. Neither substitutes
for the other, and the fumi number needed both.

## Log

- 2026-08-04 — Programme opened. Evidence from the lane sweep's walk
  markers and from `review-agent.md`'s trigger checklist; `review_cycles`
  confirmed computed and unread. R1–R4 drafted; N, reset semantics,
  scope and the closing-gate question left open.

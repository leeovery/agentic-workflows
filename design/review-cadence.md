# Review Cadence — how often a review runs, not how much it returns

The lanes programme cut what a review *returns*: a bar on what is worth
raising, and a presentation that matches the ceremony to the move owed.
The maturity programme graded what a review *looks for*. Both left
untouched how often a review *runs*. Design log for the work that damps
it. Opened 2026-08-04, closed into review-maturity M7 the same day,
reopened 2026-08-20 with the field evidence M7 was waiting for.

## Motivation (2026-08-04, held)

- **The trigger is looser than it reads.** `review-agent.md`'s checklist
  gates on conditions local to the most recent write: meaningful content
  committed, all prior reviews drained, not the first commit, 2–3
  conversational exchanges since the last dispatch. Every one of those
  clears again the moment a review finishes and one more decision lands.
  Nothing in the checklist is a function of how many reviews the topic
  has already had, or of how much the document has moved.

- **The self-healing property cuts both ways.** The drained-review block
  is deliberately self-healing — the next meaningful commit re-fires the
  trigger, so no dispatch is ever lost. That is correct for a topic on
  its first review and wrong for a topic on its sixth: the same
  mechanism that guarantees coverage early guarantees churn late.

- **The signal already exists and nothing reads it.**
  `discussion-process/scripts/gateway.cjs` computes `review_cycles` per
  topic and publishes it in the map call's DATA section. No prose
  anywhere branches on it. It has been a dead signal since it was added.

## Field evidence (2026-08-20)

M7 deferred cadence until the first real use of the maturity stack.
That use exists: fumi, on v0.6.61 — which contains the maturity release
(v0.6.37), with `review-agent.md` and the review agent brief
byte-identical to main. The graded bar changed what reviews return;
rounds-per-topic is unchanged:

- fumi's four in-progress discussion topics carry **6, 8, 9 and 7
  review rows** — ~30 background reviews on one work unit.

- **Replay.** The discussion map's history is reconstructable from the
  manifest's git log, and each review row carries its dispatch time. For
  every review that ran, we measured map movement (subtopics added +
  forward state transitions) since the previous review, then asked which
  dispatches a movement-gated backoff would have permitted. Result:
  **16 of 30** under `needed = n` (review n+1 needs n movements).

- **The distribution is bimodal, so curve shape barely matters.**
  Nearly every dispatch either followed 5–24 map movements (a real
  stage change — every candidate curve permits it) or 0–2 (drain-then-
  one-commit churn — every candidate curve blocks it). Gentle
  (`⌈n/2⌉`) permits 18/30, steep (`2^(n-1)`) 15/30. Both of
  note-model's same-day double dispatches fired on **zero** map
  movement. The win is requiring movement at all, plus mild escalation;
  steepening past that buys nothing and risks starving a genuinely
  moving topic late.

- Caveat: the replay is a suppression-only counterfactual — it asks
  which actual dispatches the rule would have permitted, not what a full
  re-run would have done (a suppressed review changes when the next
  drain happens). Sufficient to pick the shape; not a simulation of the
  alternate session.

## The settled shape (2026-08-20)

- **C1 — movement replaces conversation rhythm.** The "2–3 exchanges
  since last dispatch" condition is deleted. A review arms on Discussion
  Map movement since the last review dispatch: subtopics added, plus
  forward state transitions (`pending → exploring → converging →
  decided`). Backward moves and reopens do not count — a reopen already
  re-arms machinery elsewhere.

- **C2 — linear backoff, capped at 3.** The first review is free
  (existing conditions). Review n+1 requires `min(n, 3)` movements
  since the last dispatch. The cap keeps late reviews permanently
  reachable at "3 fresh moves" instead of climbing toward a de-facto
  ceiling; a hard ceiling N is rejected because fumi shows the natural
  count is topic-size-dependent (6–9 on real topics).

- **C3 — the engine owns the verdict.** At dispatch, a discussion
  review row is stamped with a map snapshot (subtopic → state). The
  arming verdict — `{armed, cycles, movement_seen, movement_needed}` —
  is computed engine-side from the latest snapshot against the current
  map, folded together with what the engine already knows (prior review
  drained, triage queue, calls queue), and surfaced where the session
  already looks. `agent dispatch` refuses an unarmed review outright —
  the same backstop pattern as the triage-queue guard. The prose
  checklist shrinks to the two judgments only the conversation can see:
  meaningful content, and no wrap-up signal.

- **C4 — the closing gate is exempt.** The mandatory final review
  before conclusion is the coverage guarantee; mid-session reviews are
  advisory fuel and carry no correctness burden. The final pass
  dispatches with an explicit flag that bypasses the movement gate
  (still stamping the snapshot). Its own trigger — has the discussion
  moved since the last review — is untouched by this programme.

- **C5 — quiet is visible.** The verdict struct rides the surfaces the
  session already reads, so a quiet topic can say why no review is
  coming ("6 cycles, 1 of 3 moves"), and a user-requested review always
  works. No mid-flow rendering — silence is the point.

- **C6 — research waits.** Research shares the checklist but has no
  map; its movement currency would be commits — cruder. All field
  evidence is discussion-side. Research follows only if it hurts there
  too.

- **Legacy rows arm permissively.** A pre-upgrade review row carries no
  snapshot, so movement is uncomputable; the check arms rather than
  suppresses. One loose review per legacy topic, after which the
  dispatch stamps a snapshot and the damping engages. Self-healing, no
  migration — nothing in committed state changes.

## Rejected shapes

- **A hard ceiling (the 2026-08-04 R2).** Request-only above N both
  under-serves big topics and over-serves small ones; fumi's natural
  counts ran 6–9 on real topics. The capped backoff keeps R2's spirit —
  late reviews cost real movement — without pinning N.

- **The offer gate (review-maturity M7's alternative).** Converting
  every would-be dispatch into a question trades review-churn for
  question-crowding. The problem is pacing, not automation; a
  background dispatch paced by movement interrupts nothing.

## Relationship to lanes and maturity

Lanes changed presentation and classification; maturity changed
emphasis. Neither touched dispatch. The three compose: fewer rounds,
each returning less, each graded to the document's stage. The fumi
number needed all three — and this programme answers M7's open
question, superseding its deferral.

## Log

- 2026-08-04 — Programme opened. Evidence from the lane sweep's walk
  markers and `review-agent.md`'s trigger checklist; `review_cycles`
  confirmed computed and unread. R1–R4 drafted; N, reset semantics,
  scope and the closing-gate question left open. Closed the same day
  into review-maturity M7: cadence deferred pending first real use of
  the graded bar.

- 2026-08-20 — Reopened on field evidence: fumi (v0.6.61, maturity
  stack included, trigger prose identical to main) ran ~30 background
  reviews across four discussion topics. Replay of the map history
  against candidate curves: 16/30 permitted under linear, bimodal
  movement distribution, curve shape immaterial. Shape settled in
  discussion: movement-gated arming (C1), `min(n, 3)` backoff (C2),
  engine-owned verdict with dispatch refusal (C3), closing gate exempt
  (C4), quiet visible (C5), research deferred (C6). Hard ceiling and
  offer gate rejected. Stack: engine (snapshot + arming + refusal) →
  prose (checklist shrinks to judgment conditions) → prose cases
  (suppressed and re-armed walks).

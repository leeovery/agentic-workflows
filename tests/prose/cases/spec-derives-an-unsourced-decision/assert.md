The prose should have taken this path:

1. the entry validates the in-progress specification and routes to
   resume; the process finds the specification file and puts the
   resume choice to the user, who continues
2. session setup resets the gate modes and finds no consult
   references; construction finds the source incorporated and nothing
   left to extract — no content is re-presented
3. review cycle 1 initialises; claims verification runs first and
   returns clean through its stub with no tracking file; input review
   runs next and returns findings through its stub, having written the
   c1 input tracking file; the tracking entry records in-progress and
   commits
4. the findings summary renders from the tracking file; the one
   finding's category is Unsourced decision, so it is never presented
   at the finding gate and never applied — the orchestrator routes it,
   choosing the discussion (the spec's sole source) as the document
   that should own the missing decision
5. classification lands on the no-sides branch and attempts the
   derivation first — and the record yields the answer: the recorded
   rationale pins the cap mechanically (a 6-second budget, two
   attempts, the retry fired immediately with no backoff, neither
   attempt deserving more room than the other, a cap no tighter than
   the budget forces → 3 seconds per attempt). The session tells the
   user in one line what was derived and from what, and does NOT
   stop — the point is never put to the user as a question, no user
   turn is consumed on it, and no incoherence surface is rendered
6. the walk checks presence, then lands the derived decision in the
   discussion's own document as a **new subtopic section** in the
   template's subtopic shape — Context, Journey carrying the
   derivation as the section's reasoning, a Decision naming the
   3-second per-attempt cap, Options Considered only where sides were
   weighed — with no dated timeline entry and no Initial wrapper,
   because no prior block exists to revise, and no map registration;
   the section speaks in the document's own voice, and nothing in it
   narrates specification, review, or this session
7. the edited discussion is reindexed through the knowledge CLI; the
   sources-stale safety valve is skipped — single-topic work has no
   sibling specs — and the resolution commits scoped to the discussion
   with the sweep shape (`--topic discussion/pay --kb --sweep`)
8. back in the findings flow the specification's Intent Creation
   Resilience content re-aligns to what the source now records — each
   attempt capped at 3 seconds, the 2-second figure gone — announced
   in one line; the finding's resolution records Routed with a note
   naming where it landed, and the tracking entry completes
9. gap analysis runs and returns clean through its stub; findings were
   surfaced, so the re-loop prompt is fetched from the engine (the
   reloop variant) and the turn stops; the user proceeds to completion
10. completion verifies tracking and the incorporated source, fetches
    the sign-off gate from the engine, and on the user's yes the topic
    completes through the engine and the conclusion commits
11. the walk stops at the pipeline continuation without invoking the
    bridge

Further claims:

- the discussion item never leaves completed — no reopen, no triage
  landing; the specification never pauses
- auto mode is never engaged on either gate; the routed finding never
  rides any auto lane
- the cap's value is never put to the user as a question — the only
  stops are the resume choice, the re-loop prompt, and sign-off
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion and a
constructed specification awaiting review:

- the discussion gains a new subtopic section owning the per-attempt
  gateway cap — 3 seconds, reasoned in the document's own voice from
  the recorded budget-and-attempts shape — with the two original
  subtopics and the Summary intact; no timeline entry anywhere
- the specification's Intent Creation Resilience content caps each
  attempt at 3 seconds, with the 2-second figure gone and the rest of
  the section as constructed
- the c1 input tracking file on disk with its one finding resolved
  Routed and a note naming where it landed; no claims or gap-analysis
  tracking files — clean reviews write none
- the manifest holding the specification completed with a date, the
  source incorporated, review_cycle at 1 with the construction
  baseline recorded (review_baseline_words), both gate modes gated,
  and the input tracking entry complete; the discussion item untouched
  and still completed
- no planning, implementation, or review artifacts anywhere

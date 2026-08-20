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
   choosing the discussion as the source that should own the missing
   decision
5. classification finds no measurement to run and no documented sides
   — this is the exchange, not a gate: the session STOPS
   conversationally, putting the unmade decision to the user (what the
   spec asserts, what the record never decided) and taking a stance;
   the incoherence conflict surface is never rendered
6. on the user's settlement (verify signatures with the gateway SDK's
   built-in verification and its default tolerance — no custom
   window), the walk checks presence, then lands the decision in the
   discussion's own document as a **new subtopic section** in the
   template's shape — Context, the short Journey, the Decision — with
   no dated timeline entry and no Initial wrapper, because no prior
   block exists to revise; nothing in the document narrates
   specification or this session
7. the edited discussion is reindexed through the knowledge CLI; the
   sources-stale safety valve is skipped — single-topic work has no
   sibling specs — and the resolution commits scoped to the discussion
8. back in the findings flow the specification's Webhook Verification
   content re-aligns to the settled decision — SDK verification,
   default tolerance, no custom window — announced in the same
   notify; the finding's resolution records Routed and the tracking
   entry completes
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
  landing
- auto mode is never engaged on either gate; the routed finding never
  rides any auto lane
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion and a
constructed specification awaiting review:

- the discussion gains a new subtopic section owning the webhook
  verification decision — SDK-built-in verification with its default
  tolerance, no custom window — in the template's Context/Journey/
  Decision shape, with the two original subtopics and the Summary
  intact; no timeline entry anywhere
- the specification's Webhook Verification content matches the settled
  decision, with the custom five-minute window gone
- the c1 input tracking file on disk with its one finding resolved
  Routed and a note naming where it landed; no claims or gap-analysis
  tracking files — clean reviews write none
- the manifest holding the specification completed with a date, the
  source incorporated, review_cycle at 1 with the construction baseline recorded (review_baseline_words), both gate modes gated, and
  the input tracking entry complete; the discussion item untouched and
  still completed
- no planning, implementation, or review artifacts anywhere

The prose should have taken this path:

1. the entry's source gate renders empty — the discussion is completed,
   nothing blocks; the phase status reads empty so the verb is a
   creation, and the handoff names the discussion as source material —
   the entry asks the user nothing
2. the process finds no specification file — a fresh start, no resume
   choice is put to the user; initialisation registers the item, the
   pending source row, review state, and both gate modes, and commits
3. construction runs gated, one topic at a time — each piece presented
   in the form it will take in the specification and explicitly
   approved before any write; auto mode is never engaged
4. at the event-backfill ground, the discussion's load-bearing claim —
   the gateway client pages capture events at 500 per request — is
   verified against the tree before extraction: the walk re-runs the
   recorded command (or an equivalent measurement) and finds it false —
   src/gateway/client.js pages at 250
5. because the corrected value undermines the recorded conclusion (a
   full-day backfill of ~2,000 events is 4 requests) but itself
   determines how it re-lands — at 250 per page the same day is 8
   requests, still far inside the 60-requests-per-minute limit, so the
   single-pass no-queue decision re-derives from the corrected value
   alone, nothing new committed and no live alternative picked — the
   session takes the repair tier: it tells the user in one line what
   was measured and how the conclusion re-lands, and does NOT stop —
   the mismatch is never put to the user as a question, no user turn
   is consumed on it, and no incoherence surface is rendered; the
   measurement made the choice. It never extracts the claim as-is and
   never patches the mismatch in the spec alone
6. the walk checks presence, then lands the repair in the discussion's
   own document: the Event Backfill Decision becomes a dated timeline —
   the corrected claim carrying its command and result, and the
   conclusion repaired against it (8 requests, recovery still a single
   synchronous pass, no queued job), above the prior prose wrapped
   verbatim under an Initial heading, the Trigger line citing the
   failed measurement — never specification or this session — and
   every restatement swept: the Journey's measurement and the Key
   Insight no longer assert 500 per page or 4 requests as standing
   fact (only the wrapped Initial block keeps the original prose)
7. the edited discussion is reindexed through the knowledge CLI; the
   sources-stale safety valve is skipped — single-topic work has no
   sibling specs — and the resolution commits scoped to the discussion
   with the sweep shape (`--topic discussion/pay --kb --sweep`)
8. construction continues against the corrected record: the
   specification's backfill content carries the corrected claim with
   its command and result and the re-derived arithmetic — 250 per
   page, 8 requests, a single synchronous pass, no queued job; no
   reconciliation or queueing scope is invented
9. the source row flips to incorporated when extraction exhausts;
   review cycle 1 runs claims verification, input review, and gap
   analysis sequentially, each clean through the stubs, never in
   parallel; completion verifies tracking and sources and puts the
   sign-off to the user; on their yes the topic completes through the
   engine and the conclusion commits
10. the walk stops at the pipeline continuation without invoking the
    bridge

Further claims:

- the discussion item never leaves completed — no reopen, no triage
  landing, no new topic; the specification never pauses
- nothing outside .workflows changes: src/gateway/client.js is read
  and measured, never edited
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion, one
gateway client file, and nothing later:

- the discussion's Event Backfill decision reads as a dated timeline:
  the top entry carries the corrected measurement (250 per page, with
  its command and result) and the conclusion re-derived against it —
  ~2,000 events is 8 requests, still far inside the rate limit, so
  recovery stays a single synchronous pass with no queued job — its
  trigger citing the failed measurement; the original decision
  survives wrapped beneath it; the Journey and the Key Insight no
  longer assert 500 per page or 4 requests as standing fact; nothing
  in the document narrates that the change came from specification
- a standalone specification at
  `.workflows/pay/specification/pay/specification.md` whose backfill
  content matches the corrected record — the measured claim carried
  with its command and result, the 8-request arithmetic, a single
  synchronous pass and no queued job
- the manifest holding the specification completed with a date, the
  discussion source incorporated, review_cycle at 1 with the
  construction baseline recorded (review_baseline_words), both gate
  modes gated, and no tracking entries; the discussion item untouched
  and still completed
- src/gateway/client.js byte-identical to the fixture
- no review tracking files on disk — clean reviews write none; no
  planning, implementation, or review artifacts anywhere

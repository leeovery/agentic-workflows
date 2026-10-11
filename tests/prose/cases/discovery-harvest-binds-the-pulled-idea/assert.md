The prose should have taken this path:

1. the shared framework loads first; dispatch sees a named work unit
   and skips the new-work arm entirely — no detection core, no opener,
   no confirm trigger
2. no pull continuation is held — this conversation did not create the
   epic — so resume detection reads the active-session marker, renders
   the resume gate, and the scripted `continue` takes the marker's
   session as the working one: nothing is deleted, the marker is left
   set, and no restart commit runs
3. the discovery gateway runs and initialisation creates no session
   log — the interrupted one is already installed
4. the loop opens on the resume branch: session-001 is read from disk,
   the briefing is drawn from it, and the resume branch's "where do you
   want to take it from here" is asked
5. the scripted reply is a harvest pull and routes straight into
   synthesis — no further exploration turn in between
6. synthesis re-reads the session log and proposes topics from the
   idea's ground alone. The pulled bug is never proposed as a topic of
   its own: the record already folded the UTC fix into the scheduled
   pickup work, so its ground lands inside whichever topic carries the
   times a customer is shown. The proposal is written, rendered through
   the map-view overlay — no topic is flagged as waiting on the roadmap,
   because both items are pulled into this epic, not waiting — and the
   synthesis gate is fetched; the scripted `yes` confirms it
7. a brief is written per confirmed topic, and document review
   reconciles the log against the conversation before anything persists
8. the topics persist in one engine batch. With no parks and no
   pull-forwards, the only move in the second persist step is the
   binds: the roadmap state is read, it shows two items joined to this
   epic with no topic, and the one whose kind is `idea` —
   `scheduled-pickup` — is bound to the confirmed topic that carries its
   identity (the same-named topic where the synthesis kept that name).
   The bug, `pickup-time-shown-in-utc`, is skipped by its kind: no bind
   is attempted for it at all, so no refusal ever comes back. The bind
   is recorded under the log's Edits as `Bound: scheduled-pickup →
   {topic}`
9. Topics Identified is filled, the Conclusion replaced, and the
   session closed through the engine — clearing the active-session
   marker and committing — and the walk stops there: no compliance
   check, no conclusion, no bridge

Further claims:

- exactly one `roadmap bind` runs, and it names `scheduled-pickup`
- no topic is named before the user's pull, and no phase work starts
  anywhere: no research or discussion item, no topic start of any kind;
  nothing is parked on or pulled forward from the roadmap
- cache scratch files (the proposal and persist payloads) are working
  artifacts of the harvest, expected in the acted world

EXPECTED WORLD — from an epic whose interrupted first session holds the
pulled notes and the worked exploration:

- the discovery map holding the confirmed topics — at least one, each
  with `source: discovery`, a summary, a description, a routing, and a
  `brief_path` to its brief — and none of them named for the bug or
  about the UTC fix alone
- the roadmap's `scheduled-pickup` item still joined to `pickup-times`,
  its join now naming the topic it was bound to, which is one of the
  map's topics; `pickup-time-shown-in-utc` still joined to
  `pickup-times` with no topic, exactly as the fixture had it; both
  keep their kind, summary, origin and source, and both notes are
  byte-identical under `.workflows/.roadmap/notes/`
- session-001's Exploration as the fixture had it, its Edits recording
  the bind, its Topics Identified one section per topic, and its
  Conclusion replaced; the active-session marker cleared
- a brief per topic under `.workflows/pickup-times/discovery/briefs/`
- the git history carries the bind's own commit and the session close's
  commit, and nothing is left dirty outside the cache

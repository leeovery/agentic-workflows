The prose should have taken this path:

1. the shared framework loads first; dispatch sees a named work unit
   and skips the new-work arm entirely — no detection core, no opener,
   no confirm trigger
2. resume detection reads the active-session marker, renders the
   resume gate, and the scripted `continue` takes the marker's session
   as the working one — nothing is deleted, the marker is left set, and
   no restart commit runs
3. the discovery gateway runs and initialisation creates no session
   log — the interrupted one is already installed
4. the loop opens on the resume branch: session-001 is read from disk,
   the briefing is drawn from it, and the resume branch's "where do you
   want to take it from here" is asked
5. the scripted reply is a harvest pull and routes straight into
   synthesis — no further exploration turn in between
6. synthesis re-reads the session log from disk, applies the
   granularity rules, and infers each topic's routing from the cues the
   record carries; it writes the proposal file — every entry carrying a
   name, a routing, a summary, and a two-or-three-sentence description
   — renders it through the map-view overlay, and fetches the synthesis
   gate; the scripted `yes` confirms it
7. on the confirmation a brief is written per confirmed topic; with no
   prior briefs there is nothing to clean up or backfill, and with no
   research or discussion items there is nothing to flag downstream
8. document review re-reads the log from disk and reconciles it against
   the conversation before anything persists
9. the persist is one engine batch built from the confirmed proposal;
   Topics Identified is filled, the Conclusion replaced, and the session
   closed through the engine — clearing the active-session marker and
   committing — and the walk stops there: no compliance check, no
   conclusion, no bridge

Further claims:

- routing follows the record's framing: the synonym-and-misspelling
  topic and the measurement topic, which the user held as unknowns
  ("I don't know what with", "I don't know what a good one looks
  like"), route to research; the behavioural-signals topic, which the
  user described with a clear shape and a choice between two familiar
  options, routes to discussion — each Topics Identified `Why` line
  naming that cue in a short clause
- each topic's description is the one the gate showed: the name,
  routing, summary, and description of every map item match its entry
  in the proposal file the overlay rendered, character for character —
  nothing re-worded or composed at persist time
- the briefs record only what the conversation settled:
  - behavioural signals — the soft decisions carry the click-through
    and purchase rates per query–product pair fed to the ranker as a
    boost, from the events pipeline; rejected paths carry dwell time
    with why it was dropped (the pipeline does not record it, and the
    instrumentation is a separate project); the nightly-batch-or-
    streaming choice sits under open questions and is decided nowhere
  - synonyms and misspellings — no soft decision says the list is to
    be replaced, or names what replaces it: the user's "I suspect we
    should … replace it … but I don't know what with" sits under open
    questions, and Claude's untaken suggestion to mine query
    reformulations from the search logs sits there too, as an option
    raised and not taken up — never as a decision
  - measurement — the soft decisions carry at most the settled point
    that a relevance change is judged against numbers rather than
    argument; what a good evaluation harness looks like, what a judged
    query set would take, and whether two part-time engineers could
    keep one current sit under open questions, resolved into no
    approach
- no topic is named before the user's pull: the briefing recaps the
  recorded threads without putting a topic set or a routing to the
  user, and the proposal file is first written after the pull
- no phase work starts anywhere: no research or discussion item, no
  topic start of any kind; nothing is parked or pulled from a roadmap
- cache scratch files (the proposal and persist payloads) are working
  artifacts of the harvest, expected in the acted world

EXPECTED WORLD — from an epic whose interrupted first session holds the
worked exploration:

- the discovery map holding three items, one per concern — each with
  `source: discovery`, a summary, a description, a routing, and a
  `brief_path` to its brief — the synonym and measurement items routed
  `research`, the behavioural-signals item routed `discussion`; none
  with any per-phase work
- `session-001.md` edited in place: every line of the fixture's
  Exploration still present and in order, nothing rewritten or
  summarised away; Edits still `(none)`; Topics Identified holding one
  section per persisted topic with its routing and rationale; the
  Conclusion stating three topics added and a map of three
- the active-session marker cleared; no `session-002.md`
- three briefs under `discovery/briefs/`, one per topic, each holding
  its soft-decisions, rejected-paths, and open-questions sections, an
  empty one reading `(none)`
- no research, discussion, specification, planning, implementation, or
  review artifacts anywhere; no roadmap node; the work-unit
  description unchanged; no second work unit

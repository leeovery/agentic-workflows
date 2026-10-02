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
4. the loop opens on the resume branch: session-001 is read from disk
   before anything is put to the user, the briefing is drawn from it,
   and the opening question is the resume branch's "where do you want
   to take it from here" — never the fresh-session cold open that asks
   the user to describe what they want to build
5. the conversation picks up the behavioural-signals concern one thread
   at a time, building on what the log records; no topics are named and
   no routing is proposed
6. at the first natural pause the running record is written into
   session-001 itself — edited in place with the file tools, never
   drafted to a staging file, never opened through
   `discovery-session open` — and committed through the engine with the
   loop's exploration-notes message on the discovery scope; the walk
   stops there

Further claims:

- nothing the fixture log records is put back to the user as though
  unknown — the three concerns are briefed from the record, not asked
  for again (a display claim: the weakest line here; steps 4 and 6
  carry the consequences)
- the Exploration records the nightly-batch-versus-streaming choice as
  still open — it is not written up as a decision
- no phase work starts anywhere: no map item, no brief, no research or
  discussion item, no topic start of any kind

EXPECTED WORLD — from an epic holding only its interrupted first
sketch:

- `session-001.md` edited in place: the fixture's Exploration paragraph
  still present word for word, with the resumed conversation's depth on
  the behavioural-signals concern layered beneath it — the events
  pipeline reliable, click-through and purchase rates per query–product
  pair fed to the ranker as a boost, the batch-or-streaming choice left
  open; the header, Description, Seed, Imports, and Map State at Start
  unchanged; Edits, Topics Identified, and Conclusion still `(none)`
- no `session-002.md`, and no session-draft staging file in the cache
- the work-unit manifest unchanged: the active-session marker still
  `001`, no discovery-map items, the description as it was
- no briefs, no proposal files, no research, discussion, or later-phase
  artifacts, no roadmap node, and no second work unit

The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent —
   silent), finds the carrier usable without asking the user anything,
   and hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart gate
   — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty store
   — the session proceeds silently), and enters the session step
4. the session loop's checks run: the triage check no-ops on an empty
   queue, and the agent check finds nothing — no agent has been
   dispatched yet. A session just opened with no thread underway is a
   natural break, so the non-empty calls queue flushes: the flush
   section routes on the queue file, finds two items and no pulled
   calls, and builds the screen
5. the screen renders through the engine's finding-batch surface with
   lane decide from a calls-batch payload — both calls, numbered, each
   naming what determined it — and its DISPLAY and MENU sections are
   emitted, the menu carrying a document-all confirm, a Discuss route,
   and an Ask route. There is NO announce menu anywhere — the
   main-thread flush has none; the screen is the first and only ask
6. the user says yes. The calls are documented one at a time — for
   each, a new subtopic added to the Discussion Map and set decided,
   its section written with the Decision block carrying the
   **Settled by derivation** marker, the write committed before the
   next begins — so two commits land, not one sweeping both. The
   landed items are removed from the queue file
7. the flush re-enters, finds `items` and `pulled` both empty, deletes
   the queue file, confirms in one line, and the session resumes — no
   further screen, no conclusion gate
8. the dispatch check rides those commits as the session loop
   prescribes, and on this topic every condition holds — the calls
   queue is now drained, no review has ever run, so the first review
   is free — so a background review dispatches and is announced in one
   line. The walk does not wait on it: nothing is scanned, read, or
   surfaced from it before the turn ends

Presentation claims — deliberate display claims; the flush's shape is
the behaviour under test:

- no announce menu and no "work through them now?" gate precedes the
  screen — the queue flushes straight into it at the break
- the screen renders from the engine, not from a template in the
  prose, and the user sees both items before anything is written
- neither call is raised individually: no scene, no worked example, no
  per-call question, no per-call stop
- exactly one stop gate stands in the whole walk after the resume
  gate: the decide screen's menu
- after the commits the confirmation is one line total, not a per-call
  recap

Further claims:

- the calls queue and the agent store stay separate: the flush itself
  reads and writes neither agent rows nor findings, and the only agent
  verb the walk runs is the dispatch its commits arm — no ack, no
  surface, no incorporate, since nothing has come back yet
- each documented call lands as a new section whose Decision block
  opens with the derivation marker naming its determinant; no finding
  id appears anywhere (these calls came from the conversation, not a
  review)
- the two decided sections already in the file are untouched; the
  Summary may be brought current, but no other ground moves
- the queue file is gone from the cache when the turn ends

EXPECTED WORLD — the fixture plus: the Discussion Map carries two new
subtopics, both `decided`; the discussion file carries a new section
per call, each Decision opening with the **Settled by derivation**
marker; each call is committed on its own;
`.workflows/.cache/pay/discussion/pay/calls-queue.json` no longer
exists; and the agent store holds one `review` row in flight with the
stub's report on disk.

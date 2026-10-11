The prose should have taken this path:

1. boot runs the pending migrations 054 and 071 live: 054's
   exact-match parser cannot recognise the malformed "## Triage:"
   heading, so no file converts — the report shows no changes — but
   the migration hands over its verify addendum (the no-match wording
   plus the check instructions); 071 finds the triage heading and
   hands over its own addendum, stating the recovery itself — each
   entry moved into the document's mailbox as the next free
   NNN-{slug}.md, its full text kept, the section body reset to
   "(none)" — and that nothing goes into a .triage/ directory,
   whatever an earlier check says; the boot response carries both in
   migrations.verify, 054's first
2. Step 0.1 fires on the verify branch despite nothing having
   migrated, and the judgment pass does what the code could not:
   reads the research and discussion artifacts, recognises the
   malformed heading holding a real parked entry in
   synonym-handling's document, moves the entry into the topic's
   mailbox (.mailbox/, as 071's addendum says — never .triage/,
   where 054's sends it) as 001-{slug}.md, the mailbox being empty,
   carrying its full text, and removes the triage content from the
   document (the section reset to "(none)", as 071's addendum says,
   or the emptied heading removed, as 054's allows where the topic is
   not completed — it is not, so either is within the instructions)
3. the review reads both the status of the paths the workflows own —
   the new mailbox file among them — and their diff, which shows the
   document change; the summary describes the recovery in natural
   language, and the user continues at the confirm gate, after which
   the migration commit runs
4. the knowledge gate passes silently (the store is ready), the
   workflow overview renders the epic's state, and the walk stops at
   the overview menu without selecting anything

Further claims:

- synonym-handling's discussion mailbox holds exactly one file,
  numbered 001, whose name carries the concern's slug and
  whose body carries the full stale-concern text with its provenance
  line
- the document holds no triage content — no parked entry text remains
  in it
- the migrations log records 054 and 071
- no .triage/ directory exists anywhere in the work unit
- no manifest phase item changed: synonym-handling's discussion item
  is still in-progress, behavioural-ranking's still completed; no
  topic verbs ran
- the knowledge store is untouched

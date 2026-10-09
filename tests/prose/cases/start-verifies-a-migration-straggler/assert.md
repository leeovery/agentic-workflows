The prose should have taken this path:

1. boot runs the pending migrations 054 and 071 live: 054's
   exact-match parser cannot recognise the malformed "## Triage:"
   heading, so no file converts — the report shows no changes — but
   the migration hands over its verify addendum (the no-match wording
   plus the check instructions); 071 finds the triage heading and
   hands over its own addendum, naming the topic's mailbox as where a
   straggler goes; the boot response carries both in
   migrations.verify, 054's first
2. Step 0.1 fires on the verify branch despite nothing having
   migrated, and the judgment pass does what the code could not:
   reads the research and discussion artifacts, recognises the
   malformed heading holding a real parked entry in
   synonym-handling's document, moves the entry into the topic's
   mailbox (.mailbox/, as the two addenda read together say — never
   .triage/) as an engine-numbered file carrying its full text,
   and removes the triage content from the document (the section
   reset or the emptied heading removed — the topic is not completed,
   so either is within the addendum's instruction)
3. the review reads both the status of the paths the workflows own —
   the new mailbox file among them — and their diff, which shows the
   document change; the summary describes the recovery in natural
   language, and the user continues at the confirm gate, after which
   the migration commit runs
4. the knowledge gate passes silently (the store is ready), the
   workflow overview renders the epic's state, and the walk stops at
   the overview menu without selecting anything

Further claims:

- synonym-handling's discussion mailbox holds exactly one
  engine-numbered file whose name carries the concern's slug and
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

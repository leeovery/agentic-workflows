The prose should have taken this path:

1. the scripted `yes` is consumed at the run-or-skip choice, so the walk
   takes the run arm — a `skip` would have returned to the caller with no
   dispatch at all
2. the dispatch is recorded through the engine, and the report lands at
   the path that response returned — the prose does not invent a path or
   pre-create the file
3. exactly one validation agent stands behind that dispatch: one dispatch
   recorded, one report written, no second of either
4. once the report has landed, the row is promoted by a scan and closed
   by an incorporate — the verdict is consumed whole, never surfaced
   finding by finding
5. the report is read and, the verdict being validated, the reference
   returns to its caller — the gap-handling choice is never reached, so
   no gaps are recorded and the investigation file is never edited

Further claims:

- nothing is committed: the validated path has no gaps to record

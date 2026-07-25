The prose should have taken this path:

1. offers the independent validation, presents the run-or-skip choice,
   and waits
2. on yes, records the dispatch through the engine and creates no report
   file of its own — the response carries the id and the path to use
3. announces that validation is running, then dispatches exactly one
   agent, synchronously
4. once the report has landed, promotes the row with a scan and closes
   it with an incorporate — the verdict is consumed whole, never
   surfaced finding by finding
5. reads the report and, the verdict being validated, states the
   confidence and returns to its caller — the gap-handling choice is
   never reached

Further claims:

- the investigation file is untouched and nothing is committed: the
  validated path has no gaps to record

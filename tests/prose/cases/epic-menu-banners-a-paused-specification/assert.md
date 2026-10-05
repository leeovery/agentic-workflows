The prose should have taken this path:

1. the title renders, the index dump runs, and the count is one; the
   work unit arrived as an argument, so no epic is picked, and the
   paused phase `specification` and the outcome `paused` are held
2. validation finds the epic in the index and runs the scoped dump for
   it, which does not read all done
3. the session is labelled with the work unit alone; the legacy
   research-split detector finds nothing to split and every map row has
   its summary and description, so nothing is backfilled
4. the gap analysis cache reads valid, so no analysis is dispatched; the
   map and the build order are both sequenced, so neither is re-derived
5. before the menu, the banner for what came in: `render phase-paused`
   for the work unit with phase `specification`, its section emitted
   verbatim — the specification paused for the epic, Behavioural
   Ranking awaiting the behavioural-ranking discussion. No completed
   banner
6. the scoped dump did not read all done, so no completion offer
   follows the banner
7. the epic's state: its marker and signpost, then the `view` snapshot
   fetched, its title, display and menu emitted verbatim, and the flow
   STOPs at the menu with nothing selected

Further claims:

- the banner is the paused banner, rendered once, before the epic's
  display — it names what the specification awaits, never a completion
- no handoff is made and no phase entry is invoked
- nothing is written: no manifest field changes, no commit

EXPECTED WORLD — unchanged from the fixture.

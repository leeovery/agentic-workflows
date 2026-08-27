The prose should have taken this path:

1. no topic resolves, so the scoped snapshot is rendered once and
   everything downstream reasons from it — the DATA section is never
   displayed or restated
2. prerequisites pass: discussions exist, two are completed, none is
   open, so nothing blocks
3. the route reads `analyze` and loads exactly that one display — the
   cache is `none`, so the first-run message is emitted and the user is
   asked whether to proceed
4. the user agrees, and the analysis flow is entered — its first act is
   the live-source check, before any discussion is read and before
   anything is written
5. the check comes back with a live source session, so the analysis holds
   off: the response's deferral section is emitted verbatim at that
   moment, naming the live session
6. the walk stops there. The stop is the whole answer — there is no
   fall-through to a previous pass, and nothing is offered instead

Further claims:

- the analysis itself never runs: no discussion document is read for
  grouping, no knowledge-base advisory query is made, no reconcile is
  applied, no cache file or cache metadata is written, and nothing is
  committed
- the deferral is read from the presence scan's own response, not
  inferred from the manifest — a peer session's liveness is not recorded
  in workflow state
- the live research topic is untouched: no phase item moves, and the
  peer's heartbeat is neither cleared nor refreshed

EXPECTED WORLD — the fixture, unchanged.

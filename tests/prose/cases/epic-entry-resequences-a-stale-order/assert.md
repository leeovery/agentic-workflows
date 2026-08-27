The prose should have taken this path:

1. workflow-start routes into continue-epic for the one active epic
2. topic discovery dispatches nothing (the gap-analysis cache settled) and the
   map sequencing step is silent (every map topic already ordered)
3. the build-order sequencing step fires — the scoped discovery output
   reports `build_order_needs_sequencing: true`, from the stale flag
   the completed specification set
4. sequence-build-order gathers the two live specification topics,
   assigns a contiguous 1..2 (which topic leads is the model's
   judgment), and records it through one `build-order sequence` call
5. the epic menu is presented — its display step runs its own view
   fetch, so no extra scoped re-run follows the sequencing

Further claims about the end state:

- both specification items carry integer orders forming a contiguous
  1..2
- `phases.specification.build_order_stale` is absent — the sequence
  call cleared it
- the discovery map's orders (1–3 from the harvest) are byte-identical
  to the fixture's — the spec-side refresh never touches the map
- no manifest field was written outside the `build-order sequence`
  transaction

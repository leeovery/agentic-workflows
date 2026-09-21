# Ideas Index

Improvement ideas for agentic-workflows. Pending items only — completed ideas are removed from the index and their files deleted (git history is the record).

| # | Idea | Scope |
|---|------|-------|
| 44 | [Sub-groups Within an Epic](epic-subgroups.md) | A named, ordered subset of an epic's topics you can spec/plan/implement end-to-end without touching the rest. **Parked deliberately (2026-08-20)** during the build-order discussion — the flat build order plus judgement already covers most of it, and the roadmap's horizons overlap the rest. Revisit only after the build order has been used on real epics; cheapest viable form is a display label plus dashboard dividers, no lifecycle or gating. See `design/build-order.md`. |
| 45 | [Cut the Test Suite's Wall Time](test-suite-wall-time.md) | `npm test` is ~10 minutes on an engine change: the pipeline simulation (135s, 1,063 spawned engine processes) and the prose snapshot rebuild (525s, 159 worlds with real git commits and a `knowledge setup` each) are nearly all of it. Run the engine in-process, copy one prebuilt store, build worlds concurrently; keep both suites in the gate. Measured 2026-09-20. |
| 46 | [Plan Review — Fidelity, Not Completeness](plan-review-fidelity.md) | The plan carries what was discussed and settles what its review trips over; it should not be hunting for gaps that were never discussed — the implementer is as capable and better placed, and the bar is 95%, not 100%. **Early discussion (2026-09-21)**, logged after the planning-review-convergence stack; nothing decided, to be discussed in a fresh context before any design is written. |

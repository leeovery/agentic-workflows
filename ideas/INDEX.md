# Ideas Index

Improvement ideas for agentic-workflows. Pending items only — completed ideas are removed from the index and their files deleted (git history is the record).

| # | Idea | Scope |
|---|------|-------|
| 10 | [Integration Validation Agent](integration-validation-agent.md) | Implementation phase |
| 17 | [Bugfix: Prior Spec Knowledge Check](bugfix-prior-spec-knowledge-check.md) | Investigation or specification phase (bugfix) |
| 28 | [Hybrid Search Ranking — Evaluate Text/Vector Weighting & Re-rank on a Real Corpus](hybrid-ranking-weighting-evaluation.md) | Knowledge base — `store.searchHybrid` weights + `index.js` `rerank()` + query pipeline |
| 39 | [Stop Hook Guards the Task Loop](stop-hook-guards-the-task-loop.md) | `workflow-implementation-process` — harness-enforced turn-end refusal while the task loop is mid-flight without a legitimate gate artifact. Escalation layer behind the shipped auto-gate continuation lines; build only if stalls recur. Marker choice waits on the menu-structure rework; verify Stop-hook payload (`transcript_path`, `stop_hook_active`) before building. |
| 44 | [Sub-groups Within an Epic](epic-subgroups.md) | A named, ordered subset of an epic's topics you can spec/plan/implement end-to-end without touching the rest. **Parked deliberately (2026-08-20)** during the build-order discussion — the flat build order plus judgement already covers most of it, and the roadmap's horizons overlap the rest. Revisit only after the build order has been used on real epics; cheapest viable form is a display label plus dashboard dividers, no lifecycle or gating. See `design/build-order.md`. |
| 45 | [Discussion Split — one discussion feeding two spec groups](discussion-split.md) | **Parked deliberately (2026-08-25)** during the topic-spawning design — grouping already lets one discussion source multiple specs, which covers most of the shape. Knowledge from the research-side spawn implementation gets appended to the idea file; keep or delete when that work lands. See `design/topic-spawning.md`. |

# Ideas Index

Improvement ideas for agentic-workflows. Pending items only — completed ideas are removed from the index and their files deleted (git history is the record).

| # | Idea | Scope |
|---|------|-------|
| 44 | [Sub-groups Within an Epic](epic-subgroups.md) | A named, ordered subset of an epic's topics you can spec/plan/implement end-to-end without touching the rest. **Parked deliberately (2026-08-20)** during the build-order discussion — the flat build order plus judgement already covers most of it, and the roadmap's horizons overlap the rest. Revisit only after the build order has been used on real epics; cheapest viable form is a display label plus dashboard dividers, no lifecycle or gating. See `design/build-order.md`. |
| 47 | [Position Line](position-line-mod.md) | One line pinned under the prompt — `{wu} · {phase} · {topic} · task N/M` — drawn by the workflow-gates mod via `$.ui.status`, read off the engine's own `session label` and `task start` calls. In-app counterpart to the tmux label; no opt-in beyond the mod's. Depends on the mod (`design/function-hook-gates.md`). |
| 48 | [Auto-Gate Stall Guard](auto-gate-stall-guard-mod.md) | Idea #39 in its proper home: a `turn.complete` hook resubmits "follow the workflow instructions" when a turn in a gated phase ends with no engine gate or blocker rendered in it (the Tick spec stalls of 2026-09-22, both modes, fresh context), plus a do-not-stop `context` on auto-gate results. No transcript parsing, no trap, prose and engine untouched. Depends on the mod. |
| 49 | [Compaction Recovery](compaction-recovery-mod.md) | A `session.compact` hook steers the summary and appends a plugin-built message to the compacted transcript naming the position and forcing a reread of the phase skill and `framework.md` — deterministic, not requested. Depends on the mod. |
| 50 | [The Engine as a Tool](engine-as-a-tool-mod.md) | The mod registers an `engine` tool with a typed `{verb, args[]}` input, so the model calls the engine without a shell (D7's zsh failure class gone) and transcript rows read as engine verbs. Makes the mod load-bearing — waits until the opt-in is retired. Depends on the mod. |

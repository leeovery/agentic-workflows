# Epic Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Present epic state, let the user choose what to do next, then enter plan mode with that specific choice.

Epic is phase-centric — all artifacts in a phase complete before moving to the next. Unlike feature/bugfix pipelines, epic doesn't route to a single next phase. Instead, present what's actionable across all phases and let the user choose.

## A. Run Epic Discovery

The bridge's own discovery provides minimal epic data. Run the workflow-continue-epic discovery scoped to this work unit for the epic state surface (`all_done`, `analysis_caches`, `needs_sequencing`, `build_order_needs_sequencing`, the discovery map):

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

Hold the output as **the most recent discovery output** — sections B–E read from it.

→ Proceed to **B. Topic Discovery**.

## B. Topic Discovery

A research or discussion conclusion may have changed source files since the last analysis. Read `analysis_caches` from the most recent discovery output, then load **[topic-discovery-dispatch.md](../../workflow-shared/references/topic-discovery-dispatch.md)** with work_unit = `{work_unit}`, analysis_caches = `{analysis_caches}`.

On return, `new_arrivals` is populated — section F reads it to render the callout above the discovery map.

→ Proceed to **C. Sequence Map**.

## C. Sequence Map

A new topic may have arrived without a suggested execution order — from section B's gap analysis, or from a prior edit. Read `needs_sequencing` from the most recent discovery output (section B re-runs discovery when the analysis adds topics, so it may be newer than A's).

#### If `needs_sequencing` is true

→ Load **[sequence-discovery-map.md](../../workflow-shared/references/sequence-discovery-map.md)** with work_unit = `{work_unit}`.

On return, re-run discovery so the later sections see the new order:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

Hold the refreshed output as the most recent discovery output for the remaining sections.

→ On return, proceed to **D. Sequence Build Order**.

#### Otherwise

The map is already sequenced.

→ Proceed to **D. Sequence Build Order**.

## D. Sequence Build Order

A completed specification flags the build order stale, and the live numbering can break — a topic without an order (a regroup, a pivot), a duplicate, or a hole left by a cancel. Read `build_order_needs_sequencing` from the most recent discovery output.

#### If `build_order_needs_sequencing` is true

→ Load **[sequence-build-order.md](../../workflow-shared/references/sequence-build-order.md)** with work_unit = `{work_unit}`.

On return, re-run discovery so the later sections see the new order:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

Hold the refreshed output as the most recent discovery output for the remaining sections.

→ On return, proceed to **E. Check All-Done**.

#### Otherwise

The build order is current.

→ Proceed to **E. Check All-Done**.

## E. Check All-Done

The scoped discovery derives `all_done` — true only when at least one non-cancelled review item exists and every non-cancelled one is completed, nothing is in progress or awaiting its next phase, no rerouted concern is parked on a research or discussion stub, no completed discussion is unaccounted, no item carries a live reconcile flag (`reconcile_pending: (none)` — a flagged item's entry flow must clear it first), and the discovery map has settled (or the epic has none). Read it from the most recent discovery output.

#### If `all_done` is `true`

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render epic-all-done-gate {work_unit}
```

**STOP.** Wait for user response.

**If user chose `y/yes`:**

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete epic pipeline"
```

Fetch and emit the receipt's `DISPLAY: confirmation` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb complete --pipeline
```

**STOP.** Do not proceed — terminal condition.

**If user chose `n/no`:**

→ Proceed to **F. Display and Menu**.

#### Otherwise

→ Proceed to **F. Display and Menu**.

## F. Display and Menu

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-completed {work_unit} --phase {completed_phase}
```

→ Load **[epic-display-and-menu.md](../../workflow-continue-epic/references/epic-display-and-menu.md)** with new_arrivals = `{new_arrivals}` (or empty when section B did not load the orchestrator).

> **CHECKPOINT**: Do not proceed until the above has returned with the user's selection.

→ On return, proceed to **G. Enter Plan Mode**.

---

## G. Enter Plan Mode

Section F returned the selected entry's `action`, `topic`, and `route` (stored by epic-display-and-menu.md **C. Route Selection**). The stored `route` is the authoritative skill invocation — the plan file carries it verbatim. Never reconstruct an invocation from the phase name; not every selection maps to a `workflow-{phase}-entry` skill. Continue discovery → `/workflow-discovery epic {work_unit}` — the only selection that doesn't route to an entry skill; every other route comes from the stored `route` verbatim.

Skills receive positional arguments: `$0` = work_type, `$1` = work_unit, `$2` = topic (optional).

#### If topic is present

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file — resolve the conditionals and placeholders, then output the result **verbatim: it is the complete plan**. Plan mode's usual job does not apply here: nothing to investigate, verify, or design, and nothing learned this session is added — the next context is designed to start empty, and additions bias it. The one sanctioned addition: anything the user explicitly asked to carry forward goes under a final `## User instructions` heading, after the template:

```
# Continue Epic: {selected_phase:(titlecase)}

Continue {selected_phase} for "{topic}" in "{work_unit}".

## Next Step

Invoke `{route}`

Arguments: work_type = epic, work_unit = {work_unit}, topic = {topic}
The skill will skip discovery and proceed directly to validation.

## How to proceed

**To the human**: approve with **"Clear context and continue"** — this project's setup keeps that plan-mode option enabled. A fresh context will follow the Next Step above.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

#### If topic is absent

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file — resolve the conditionals and placeholders, then output the result **verbatim: it is the complete plan**. Plan mode's usual job does not apply here: nothing to investigate, verify, or design, and nothing learned this session is added — the next context is designed to start empty, and additions bias it. The one sanctioned addition: anything the user explicitly asked to carry forward goes under a final `## User instructions` heading, after the template:

```
# Continue Epic: {selected_phase:(titlecase)}

@if(action == continue_discovery) Continue discovery for "{work_unit}" — re-shape the topic map. @else Start {selected_phase} phase for "{work_unit}". @endif

## Next Step

Invoke `{route}`

Arguments: work_type = epic, work_unit = {work_unit}
@if(action == continue_discovery) The discovery skill detects the existing work unit and re-shapes the map. @else The skill will run discovery with epic context. @endif

## How to proceed

**To the human**: approve with **"Clear context and continue"** — this project's setup keeps that plan-mode option enabled. A fresh context will follow the Next Step above.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

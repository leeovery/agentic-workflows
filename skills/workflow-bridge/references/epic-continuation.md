# Epic Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Present epic state, let the user choose what to do next, then enter plan mode with that specific choice.

Epic is phase-centric — all artifacts in a phase complete before moving to the next. Unlike feature/bugfix pipelines, epic doesn't route to a single next phase. Instead, present what's actionable across all phases and let the user choose.

## A. Run Epic Discovery

The bridge's own discovery provides minimal epic data. Run the workflow-continue-epic discovery scoped to this work unit for the epic state surface (`all_done`, `analysis_caches`, `needs_sequencing`, the discovery map):

```bash
node .claude/skills/workflow-continue-epic/scripts/discovery.cjs {work_unit}
```

Hold the output as **the most recent discovery output** — sections B–D read from it.

→ Proceed to **B. Topic Discovery**.

## B. Topic Discovery

A research or discussion conclusion may have changed source files since the last analysis. Read `analysis_caches` from the most recent discovery output, then load **[topic-discovery-dispatch.md](../../workflow-shared/references/topic-discovery-dispatch.md)** with work_unit = `{work_unit}`, analysis_caches = `{analysis_caches}`.

On return, `new_arrivals` is populated — section E reads it to render the callout above the discovery map.

→ Proceed to **C. Sequence Map**.

## C. Sequence Map

A new topic may have arrived without a suggested execution order — from section B's analyses, or from a prior edit. Read `needs_sequencing` from the most recent discovery output (section B re-runs discovery when its analyses add topics, so it may be newer than A's).

#### If `needs_sequencing` is true

→ Load **[sequence-discovery-map.md](../../workflow-shared/references/sequence-discovery-map.md)** with work_unit = `{work_unit}`.

On return, re-run discovery so section E sees the new order:

```bash
node .claude/skills/workflow-continue-epic/scripts/discovery.cjs {work_unit}
```

Hold the refreshed output as the most recent discovery output for the remaining sections.

→ Proceed to **D. Check All-Done**.

#### Otherwise

The map is already sequenced.

→ Proceed to **D. Check All-Done**.

## D. Check All-Done

The scoped discovery derives `all_done` — true only when review items exist and every non-cancelled one is completed, nothing is in progress or awaiting its next phase, no completed discussion is unaccounted, and the discovery map has settled (or the epic has none). Read it from the most recent discovery output.

#### If `all_done` is `true`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
All topics have completed review for "{work_unit:(titlecase)}".

- **`y`/`yes`** — Mark this epic as completed
- **`n`/`no`** — Return to the epic menu

· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `y`/`yes`:**

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete epic pipeline"
```

> *Output the next fenced block as a code block:*

```
Epic Completed

"{work_unit:(titlecase)}" has completed all topics through review.
```

**STOP.** Do not proceed — terminal condition.

**If user chose `n`/`no`:**

→ Proceed to **E. Display and Menu**.

#### Otherwise

→ Proceed to **E. Display and Menu**.

## E. Display and Menu

> *Output the next fenced block as a code block:*

```
{completed_phase:(titlecase)} completed for "{work_unit:(titlecase)}".
```

→ Load **[epic-display-and-menu.md](../../workflow-continue-epic/references/epic-display-and-menu.md)** with new_arrivals = `{new_arrivals}` (or empty when section B did not load the orchestrator).

> **CHECKPOINT**: Do not proceed until the above has returned with the user's selection.

→ Proceed to **F. Enter Plan Mode**.

---

## F. Enter Plan Mode

Map the selection to a skill invocation using this routing table:

| Selection | Skill | Work Type | Work Unit | Topic |
|-----------|-------|-----------|-----------|-------|
| Continue discussion | `/workflow-discussion-entry` | epic | {work_unit} | {topic} |
| Continue specification | `/workflow-specification-entry` | epic | {work_unit} | {topic} |
| Continue plan | `/workflow-planning-entry` | epic | {work_unit} | {topic} |
| Continue implementation | `/workflow-implementation-entry` | epic | {work_unit} | {topic} |
| Continue research | `/workflow-research-entry` | epic | {work_unit} | {topic} |
| Start specification | `/workflow-specification-entry` | epic | {work_unit} | — |
| Start planning for {topic} | `/workflow-planning-entry` | epic | {work_unit} | {topic} |
| Start implementation of {topic} | `/workflow-implementation-entry` | epic | {work_unit} | {topic} |
| Start review for {topic} | `/workflow-review-entry` | epic | {work_unit} | {topic} |
| Start new research | `/workflow-research-entry` | epic | {work_unit} | — |
| Start new discussion | `/workflow-discussion-entry` | epic | {work_unit} | — |

Skills receive positional arguments: `$0` = work_type, `$1` = work_unit, `$2` = topic (optional).

#### If topic is present

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Epic: {selected_phase:(titlecase)}

Continue {selected_phase} for "{topic}" in "{work_unit}".

## Next Step

Invoke `/workflow-{selected_phase}-entry epic {work_unit} {topic}`

Arguments: work_type = epic, work_unit = {work_unit}, topic = {topic}
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

#### If topic is absent

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Epic: {selected_phase:(titlecase)}

Start {selected_phase} phase for "{work_unit}".

## Next Step

Invoke `/workflow-{selected_phase}-entry epic {work_unit}`

Arguments: work_type = epic, work_unit = {work_unit}
The skill will run discovery with epic context.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

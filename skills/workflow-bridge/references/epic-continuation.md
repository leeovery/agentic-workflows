# Epic Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Present epic state, let the user choose what to do next, then enter plan mode with that specific choice.

Epic is phase-centric — all artifacts in a phase complete before moving to the next. Unlike feature/bugfix pipelines, epic doesn't route to a single next phase. Instead, present what's actionable across all phases and let the user choose.

## A. Run Epic Discovery

The bridge's own discovery provides minimal epic data. Run the continue-epic discovery scoped to this work unit for enriched state (dependencies, implementation progress, format):

```bash
node .claude/skills/continue-epic/scripts/discovery.cjs {work_unit}
```

Parse the output. Use the epic's `detail` object as the discovery data for the display.

→ Proceed to **B. Topic Discovery**.

## B. Topic Discovery

A research or discussion conclusion may have changed source files since the last analysis. Read `analysis_caches` from the `detail` object parsed in A:

- `analysis_caches.research_analysis.status` — `valid` | `stale` | `absent`
- `analysis_caches.gap_analysis.status` — same

#### If both caches are `valid` or `absent`

No analyses to run.

→ Proceed to **C. Check All-Done**.

#### If at least one cache is `stale`

→ Load **[topic-discovery.md](../../workflow-shared/references/topic-discovery.md)** with work_unit = `{work_unit}`.

On return, store the orchestrator's `new_arrivals` tracker in conversation memory — section D reads it to render the callout above the discovery map.

Re-run discovery for fresh state including auto-added items:

```bash
node .claude/skills/continue-epic/scripts/discovery.cjs {work_unit}
```

→ Proceed to **C. Check All-Done**.

## C. Check All-Done

Using the enriched discovery data from section A, check if ALL topics across ALL phases have review status `completed`. Specifically: check if any review items exist, and if so, whether every one has `status: completed`, and no topics in earlier phases are still `in-progress`.

#### If all topics have completed review

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

Set the work unit status to completed:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit} status completed
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit} completed_at $(date +%Y-%m-%d)
```

Commit: `workflow({work_unit}): complete epic pipeline`

> *Output the next fenced block as a code block:*

```
Epic Completed

"{work_unit:(titlecase)}" has completed all topics through review.
```

**STOP.** Do not proceed — terminal condition.

**If user chose `n`/`no`:**

→ Proceed to **D. Display and Menu**.

#### Otherwise

→ Proceed to **D. Display and Menu**.

## D. Display and Menu

> *Output the next fenced block as a code block:*

```
{completed_phase:(titlecase)} completed for "{work_unit:(titlecase)}".
```

→ Load **[epic-display-and-menu.md](../../continue-epic/references/epic-display-and-menu.md)** with new_arrivals = `{new_arrivals}` (or empty when section B did not load the orchestrator).

> **CHECKPOINT**: Do not proceed until the above has returned with the user's selection.

→ Proceed to **E. Enter Plan Mode**.

---

## E. Enter Plan Mode

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

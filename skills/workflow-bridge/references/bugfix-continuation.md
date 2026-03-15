# Bugfix Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a bugfix to its next pipeline phase, with an option to revisit earlier phases.

Bugfix pipeline: Investigation → Specification → Planning → Implementation → Review

## Phase Routing

Use `next_phase` from discovery output to determine the target skill:

| next_phase | Target Skill |
|------------|--------------|
| investigation | workflow-investigation-entry |
| specification | workflow-specification-entry |
| planning | workflow-planning-entry |
| implementation | workflow-implementation-entry |
| review | workflow-review-entry |
| done | (terminal) |

## A. Check Terminal

#### If `next_phase` is `done`

Set the work unit status to completed:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} status completed
```

> *Output the next fenced block as a code block:*

```
Bugfix Completed

"{work_unit:(titlecase)}" has completed all pipeline phases.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Set `target_phase` = `next_phase`.

→ Proceed to **B. Offer Early Completion**.

## B. Offer Early Completion

#### If `next_phase` is `review`

Implementation has just completed. Offer the user a choice to skip review and complete early.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Implementation completed for "{work_unit:(titlecase)}".

- **`y`/`yes`** — Proceed to review
- **`d`/`done`** — Complete without review

· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `d`/`done`:**

Set the work unit status to completed:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} status completed
```

> *Output the next fenced block as a code block:*

```
Bugfix Completed

"{work_unit:(titlecase)}" completed — review skipped.
```

**STOP.** Do not proceed — terminal condition.

**If user chose `y`/`yes`:**

→ Proceed to **C. Check for Earlier Phases**.

#### Otherwise

→ Proceed to **C. Check for Earlier Phases**.

## C. Check for Earlier Phases

Check if there are completed phases earlier in the pipeline that the user could revisit. Look at the discovery output's `phases` data — any phase with status `completed` that comes before `next_phase` in the pipeline order.

#### If no earlier completed phases exist

→ Proceed to **F. Enter Plan Mode**.

#### If earlier completed phases exist

→ Proceed to **D. Offer Revisit**.

## D. Offer Revisit

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{previous_phase:(titlecase)} completed for "{work_unit:(titlecase)}".

- **`y`/`yes`** — Proceed to {next_phase}
- **`r`/`revisit`** — Revisit an earlier phase

· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `y`/`yes`

→ Proceed to **F. Enter Plan Mode**.

#### If user chose `r`/`revisit`

→ Proceed to **E. Select Phase**.

## E. Select Phase

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which phase would you like to revisit?

1. {phase:(titlecase)} — completed
2. ...
{N}. Back

Select an option (enter number):
· · · · · · · · · · · ·
```

List only completed phases that come before `next_phase`.

**STOP.** Wait for user response.

#### If user chose Back

→ Return to **D. Offer Revisit**.

#### If user chose a phase

Set `target_phase` = selected phase.

→ Proceed to **F. Enter Plan Mode**.

## F. Enter Plan Mode

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Bugfix: {work_unit}

@if(target_phase == next_phase) The previous phase has completed. Continue the pipeline. @else Revisiting an earlier phase. @endif

## Next Step

Invoke `/workflow-{target_phase}-entry bugfix {work_unit}`

Arguments: work_type = bugfix, work_unit = {work_unit} (topic inferred from work_unit)
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

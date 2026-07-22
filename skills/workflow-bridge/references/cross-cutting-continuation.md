# Cross-Cutting Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a cross-cutting concern to its next pipeline phase, with an option to revisit earlier phases.

Cross-cutting pipeline: (Research) → Discussion → Specification (terminal)

## A. Check Terminal

#### If `next_phase` is `done`

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete cross-cutting pipeline" --pipeline
```

Emit the response's `DISPLAY: confirmation` section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Set `target_phase` = `next_phase`.

→ Proceed to **B. Check for Earlier Phases**.

## B. Check for Earlier Phases

Read the discovery output's `revisitable_phases` — the completed phases the user could revisit.

#### If `revisitable_phases` is `(none)`

→ Proceed to **E. Enter Plan Mode**.

#### Otherwise

→ Proceed to **C. Offer Revisit**.

## C. Offer Revisit

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render revisit-gate {work_unit} --prev {previous_phase} --next {next_phase}
```

**STOP.** Wait for user response.

#### If user chose `y`/`yes`

→ Proceed to **E. Enter Plan Mode**.

#### If user chose `r`/`revisit`

→ Proceed to **D. Select Phase**.

## D. Select Phase

Emit the discovery output's `MENU: revisit phases` section verbatim as markdown (not a code block). Its numbering follows `revisitable_phases` order.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **C. Offer Revisit**.

#### If user chose a phase

Set `target_phase` = the number's phase in `revisitable_phases`.

→ Proceed to **E. Enter Plan Mode**.

## E. Enter Plan Mode

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file **verbatim — this is the complete plan**. Plan mode's usual job does not apply here: nothing to investigate, verify, or design, and nothing learned this session is added — the next context is designed to start empty, and additions bias it. The one sanctioned addition: anything the user explicitly asked to carry forward goes under a final `## User instructions` heading, after the template:

```
# Continue Cross-Cutting: {work_unit}

@if(target_phase == next_phase) The previous phase has completed. Continue the pipeline. @else Revisiting an earlier phase. @endif

## Next Step

Invoke `/workflow-{target_phase}-entry cross-cutting {work_unit}`

Arguments: work_type = cross-cutting, work_unit = {work_unit} (topic inferred from work_unit)
The skill will skip discovery and proceed directly to validation.

## How to proceed

**To the human**: approve with **"Clear context and continue"** — this project's setup keeps that plan-mode option enabled. A fresh context will follow the Next Step above.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

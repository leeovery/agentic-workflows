# Epic Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Present epic state, let the user choose what to do next, then enter plan mode with that specific choice.

Epic is phase-centric — all artifacts in a phase complete before moving to the next. Unlike feature/bugfix pipelines, epic doesn't route to a single next phase. Instead, present what's actionable across all phases and let the user choose.

## A. Run Epic Discovery

The bridge's own discovery provides minimal epic data. Run the continue-epic discovery for enriched state (dependencies, implementation progress, format):

```bash
node .claude/skills/continue-epic/scripts/discovery.js
```

Parse the output to find the epic matching `{work_unit}`. Use that epic's `detail` object as the discovery data for the shared display.

## B. Display and Menu

> *Output the next fenced block as a code block:*

```
{completed_phase:(titlecase)} concluded for "{work_unit:(titlecase)}".
```

Load **[epic-display-and-menu.md](../../continue-epic/references/epic-display-and-menu.md)** and follow its instructions as written.

The shared reference will display the epic state and present the menu, then return with the user's selection (action, phase, topic).

#### If action is `resume_concluded`

Load **[resume-concluded.md](../../continue-epic/references/resume-concluded.md)** and follow its instructions as written.

This skill ends after resume-concluded routes to a phase skill. Terminal.

#### Otherwise

→ Proceed to **C. Enter Plan Mode**.

---

## C. Enter Plan Mode

Map the selection to a skill invocation using this routing table:

| Selection | Skill | Work Type | Work Unit | Topic |
|-----------|-------|-----------|-----------|-------|
| Continue discussion | `/workflow-discussion-entry` | epic | {work_unit} | {topic} |
| Continue specification | `/workflow-specification-entry` | epic | {work_unit} | — |
| Continue plan | `/workflow-planning-entry` | epic | {work_unit} | {topic} |
| Continue implementation | `/workflow-implementation-entry` | epic | {work_unit} | {topic} |
| Continue research | `/workflow-research-entry` | epic | {work_unit} | — |
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

Call the `ExitPlanMode` tool to present the plan to the user for approval. The user will then clear context and continue.

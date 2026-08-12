# Manage the Baseline

*Reference for **[workflow-baseline](../SKILL.md)***

---

The assessment is complete. Show what exists and offer the ways back in.

## A. Display and Menu

Fetch the doc list and emit its `DISPLAY: baseline progress` section verbatim as a code block:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-progress
```

Fetch the gate and emit its `MENU: baseline manage gate` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-manage-gate
```

**STOP.** Wait for user response.

## B. Handle Selection

#### If `expand`

Ask what ground to add or deepen if the user hasn't already said. Set mode = `expand` — the scoping flow branches on it.

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

#### If `view`

Fetch the picker and emit its `MENU: baseline doc pick` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-doc-pick
```

**STOP.** Wait for user response.

**If `back`:**

→ Return to **A. Display and Menu**.

**If the user names an area:**

Render the chosen `.workflows/.baseline/{area}.md` verbatim as markdown.

→ Return to **A. Display and Menu**.

#### If `back`

> *Output the next fenced block as a code block:*

```
Baseline unchanged. Run /workflow-start to pick up other work.
```

**STOP.** Do not proceed — terminal condition.

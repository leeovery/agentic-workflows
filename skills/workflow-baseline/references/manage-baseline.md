# Manage the Baseline

*Reference for **[workflow-baseline](../SKILL.md)***

---

The assessment is complete. Show what exists and offer the ways back in.

## A. Display and Menu

Fetch the doc list and emit its `DISPLAY: baseline progress` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-progress
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ What would you like to do?`**

**`e/expand`** → Add a new area, or deepen an existing one
**`v/view`**   → Read an area doc
**`b/back`**   → Leave the baseline as it is
```

**STOP.** Wait for user response.

## B. Handle Selection

#### If `expand`

Ask what ground to add or deepen if the user hasn't already said. Set mode = `expand` — the scoping flow branches on it.

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

#### If `view`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which doc? (enter the area name, or **`b/back`**)
```

**STOP.** Wait for user response.

Render the chosen `.workflows/.baseline/{area}.md` verbatim as markdown.

→ Return to **A. Display and Menu**.

#### If `back`

> *Output the next fenced block as a code block:*

```
Baseline unchanged. Run /workflow-start to pick up other work.
```

**STOP.** Do not proceed — terminal condition.

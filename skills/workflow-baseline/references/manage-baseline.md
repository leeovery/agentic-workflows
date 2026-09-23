# Manage the Baseline

*Reference for **[workflow-baseline](../SKILL.md)***

---

The assessment is complete. Show what exists and offer the ways back in.

## A. Display and Menu

Fetch the doc list and emit its `DISPLAY: baseline progress` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-progress
```

Fetch the gate and emit its `MENU: baseline manage gate` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-manage-gate
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

## B. Handle Selection

#### If `expand`

Ask what ground to add or deepen if the user hasn't already said. Set mode = `expand` — the scoping flow branches on it.

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

#### If `view`

Fetch the picker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-doc-pick
```

Read the `DATA` section to reason from — its `DOCS` table gives one `key  area` row per doc. Never display that section. Then emit the `MENU: baseline doc pick` section verbatim per its marker.

**STOP.** Wait for user response.

**If `back`:**

→ Return to **A. Display and Menu**.

**If the user picked a doc:**

Set `area` from that key's `DOCS` row, and render `.workflows/.baseline/{area}.md` verbatim as markdown.

→ Return to **A. Display and Menu**.

#### If `back`

→ Load **[start-menu.md](../../workflow-start/references/start-menu.md)**.

# Select Output Format

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Select the plan output format using the same project-default logic as the planning skill.

## A. Check Format Recommendation

Read the project default `plan_format` via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.defaults.plan_format
```

#### If output is empty (no project default)

→ Proceed to **B. Select Format**.

#### Otherwise

The surface reads the default itself and names it in both the label and the accept row:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render plan-format-gate
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `yes`:**

→ Load **[format-version-check.md](../../workflow-shared/references/format-version-check.md)** with format = `{plan_format}`.

→ Return to caller.

**If `no`:**

→ Proceed to **B. Select Format**.

---

## B. Select Format

→ Load **[output-formats.md](../../workflow-planning-process/references/output-formats.md)** and follow its instructions as written.

→ Load the chosen format's **[about.md](../../workflow-planning-process/references/output-formats/{chosen-format}/about.md)** and follow its Setup section — complete any prerequisites (installation, initialisation, MCP configuration) before tasks are written.

→ Load **[format-version-check.md](../../workflow-shared/references/format-version-check.md)** with format = `{chosen-format}`.

→ Return to caller.
